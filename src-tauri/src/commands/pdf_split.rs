use crate::platform::pathing::{build_output_filename, default_base_name_from_path};
use lopdf::Document;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfMetadataRequest {
    input_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfMetadataResponse {
    file_name: String,
    page_count: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitSegment {
    start: usize,
    end: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitPdfRequest {
    input_path: String,
    output_dir: String,
    base_name: String,
    segments: Vec<SplitSegment>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitPdfResponse {
    output_files: Vec<String>,
}

#[tauri::command]
pub fn get_pdf_metadata(request: PdfMetadataRequest) -> Result<PdfMetadataResponse, String> {
    let input_path = PathBuf::from(&request.input_path);
    let document = Document::load(&input_path).map_err(|error| error.to_string())?;
    let page_count = document.get_pages().len();

    Ok(PdfMetadataResponse {
        file_name: input_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("document.pdf")
            .to_string(),
        page_count,
    })
}

#[tauri::command]
pub fn split_pdf(request: SplitPdfRequest) -> Result<SplitPdfResponse, String> {
    let input_path = PathBuf::from(&request.input_path);
    let output_dir = PathBuf::from(&request.output_dir);
    let original = Document::load(&input_path).map_err(|error| error.to_string())?;
    let page_count = original.get_pages().len();

    validate_segments(&request.segments, page_count)?;
    fs::create_dir_all(&output_dir).map_err(|error| error.to_string())?;

    let base_name = if request.base_name.trim().is_empty() {
        default_base_name_from_path(&input_path)
    } else {
        request.base_name.clone()
    };

    let mut output_files = Vec::with_capacity(request.segments.len());

    for (index, segment) in request.segments.iter().enumerate() {
        let file_name = build_output_filename(&base_name, &segment_label(segment), index);
        let destination = resolve_available_output_path(&output_dir, &file_name);
        let bytes = extract_segment_pdf(&original, segment.start, segment.end)?;

        fs::write(&destination, bytes).map_err(|error| error.to_string())?;
        output_files.push(destination.to_string_lossy().to_string());
    }

    Ok(SplitPdfResponse { output_files })
}

fn validate_segments(segments: &[SplitSegment], page_count: usize) -> Result<(), String> {
    if segments.is_empty() {
        return Err("At least one segment is required".into());
    }

    let mut seen_pages = HashSet::new();

    for segment in segments {
        if segment.start < 1 || segment.end < 1 {
            return Err("Page indexes must be 1-based".into());
        }

        if segment.start > segment.end {
            return Err("Segment start cannot be greater than segment end".into());
        }

        if segment.end > page_count {
            return Err("Segment exceeds the PDF page count".into());
        }

        for page in segment.start..=segment.end {
            if !seen_pages.insert(page) {
                return Err("Overlapping page segments are not allowed".into());
            }
        }
    }

    Ok(())
}

fn segment_label(segment: &SplitSegment) -> String {
    if segment.start == segment.end {
        segment.start.to_string()
    } else {
        format!("{}-{}", segment.start, segment.end)
    }
}

fn resolve_available_output_path(output_dir: &Path, file_name: &str) -> PathBuf {
    let destination = output_dir.join(file_name);
    if !destination.exists() {
        return destination;
    }

    let file_path = Path::new(file_name);
    let stem = file_path
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("split");
    let extension = file_path
        .extension()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("pdf");

    for copy_index in 1.. {
        let candidate = output_dir.join(format!("{stem}-copy-{copy_index:02}.{extension}"));
        if !candidate.exists() {
            return candidate;
        }
    }

    unreachable!("copy-index loop must eventually find an available file name")
}

fn extract_segment_pdf(original: &Document, start: usize, end: usize) -> Result<Vec<u8>, String> {
    let pages = original.get_pages();
    let mut cloned = original.clone();
    let mut keep_pages = HashSet::new();

    for page in start..=end {
        keep_pages.insert(page as u32);
    }

    let mut remove_pages = pages
        .keys()
        .copied()
        .filter(|page| !keep_pages.contains(page))
        .collect::<Vec<u32>>();
    remove_pages.sort_unstable();
    remove_pages.reverse();

    for page in remove_pages {
        cloned.delete_pages(&[page]);
    }

    let mut output = Vec::new();
    cloned
        .save_to(&mut output)
        .map_err(|error| error.to_string())?;

    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::{
        get_pdf_metadata, split_pdf, validate_segments, PdfMetadataRequest, SplitPdfRequest,
        SplitSegment,
    };
    use crate::platform::pathing::{build_output_filename, default_base_name_from_path};
    use lopdf::content::{Content, Operation};
    use lopdf::{dictionary, Document, Object, ObjectId, Stream};
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn rejects_overlapping_segments() {
        let result = validate_segments(
            &[
                SplitSegment { start: 1, end: 3 },
                SplitSegment { start: 3, end: 5 },
            ],
            12,
        );

        assert!(result.is_err());
    }

    #[test]
    fn builds_stable_output_names() {
        let output = build_output_filename("Campus Kit", "4-7", 1);
        assert_eq!(output, "Campus-Kit-part-02-pages-4-7.pdf");
    }

    #[test]
    fn falls_back_to_path_stem() {
        let output = default_base_name_from_path(Path::new("C:/docs/report.final.pdf"));
        assert_eq!(output, "report.final");
    }

    #[test]
    fn reads_metadata_from_a_real_pdf_file() {
        let file_path = build_temp_pdf_path();
        write_sample_pdf(&file_path, &["CampusKit PDF metadata test"]);

        let response = get_pdf_metadata(PdfMetadataRequest {
            input_path: file_path.to_string_lossy().to_string(),
        })
        .expect("sample pdf metadata should load");

        assert_eq!(
            response.file_name,
            file_path.file_name().and_then(|value| value.to_str()).unwrap()
        );
        assert_eq!(response.page_count, 1);

        std::fs::remove_file(file_path).expect("sample pdf should be removed");
    }

    #[test]
    fn splits_a_real_pdf_and_avoids_overwriting_existing_output_files() {
        let input_path = build_temp_pdf_path();
        let output_dir = build_temp_output_dir();
        write_sample_pdf(
            &input_path,
            &[
                "CampusKit split test page 1",
                "CampusKit split test page 2",
                "CampusKit split test page 3",
            ],
        );

        let request = SplitPdfRequest {
            input_path: input_path.to_string_lossy().to_string(),
            output_dir: output_dir.to_string_lossy().to_string(),
            base_name: "campuskit-sample".into(),
            segments: vec![
                SplitSegment { start: 1, end: 1 },
                SplitSegment { start: 2, end: 3 },
            ],
        };

        let first_run = split_pdf(request).expect("first split should succeed");
        assert_eq!(first_run.output_files.len(), 2);
        assert!(first_run.output_files[0].ends_with("campuskit-sample-part-01-pages-1.pdf"));
        assert!(first_run.output_files[1].ends_with("campuskit-sample-part-02-pages-2-3.pdf"));

        for output_path in &first_run.output_files {
            assert!(Path::new(output_path).exists(), "split output should be written");
        }

        let first_file_metadata = get_pdf_metadata(PdfMetadataRequest {
            input_path: first_run.output_files[0].clone(),
        })
        .expect("first split output should be a readable pdf");
        let second_file_metadata = get_pdf_metadata(PdfMetadataRequest {
            input_path: first_run.output_files[1].clone(),
        })
        .expect("second split output should be a readable pdf");
        assert_eq!(first_file_metadata.page_count, 1);
        assert_eq!(second_file_metadata.page_count, 2);

        let second_run = split_pdf(SplitPdfRequest {
            input_path: input_path.to_string_lossy().to_string(),
            output_dir: output_dir.to_string_lossy().to_string(),
            base_name: "campuskit-sample".into(),
            segments: vec![
                SplitSegment { start: 1, end: 1 },
                SplitSegment { start: 2, end: 3 },
            ],
        })
        .expect("second split should succeed");
        assert_eq!(second_run.output_files.len(), 2);
        assert!(second_run.output_files[0].ends_with("campuskit-sample-part-01-pages-1-copy-01.pdf"));
        assert!(second_run.output_files[1].ends_with("campuskit-sample-part-02-pages-2-3-copy-01.pdf"));
        assert_ne!(first_run.output_files, second_run.output_files);

        for output_path in &second_run.output_files {
            assert!(Path::new(output_path).exists(), "renamed split output should be written");
        }

        fs::remove_file(input_path).expect("sample input pdf should be removed");
        fs::remove_dir_all(output_dir).expect("sample output directory should be removed");
    }

    fn build_temp_pdf_path() -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("campuskit-metadata-{timestamp}.pdf"))
    }

    fn build_temp_output_dir() -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("campuskit-split-output-{timestamp}"))
    }

    fn write_sample_pdf(path: &Path, page_texts: &[&str]) {
        let mut document = Document::with_version("1.5");
        let pages_id = document.new_object_id();

        let font_id = document.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Courier",
        });

        let resources_id = document.add_object(dictionary! {
            "Font" => dictionary! {
                "F1" => font_id,
            },
        });

        let page_ids = page_texts
            .iter()
            .map(|text| build_sample_page(&mut document, pages_id, resources_id, text))
            .collect::<Vec<ObjectId>>();

        document.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => page_ids
                    .iter()
                    .copied()
                    .map(Object::Reference)
                    .collect::<Vec<Object>>(),
                "Count" => page_ids.len() as i64,
            }),
        );

        let catalog_id = document.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });

        document.trailer.set("Root", catalog_id);
        document.compress();
        document.save(path).expect("sample pdf should be written");
    }

    fn build_sample_page(
        document: &mut Document,
        pages_id: ObjectId,
        resources_id: ObjectId,
        text: &str,
    ) -> ObjectId {
        let content = Content {
            operations: vec![
                Operation::new("BT", vec![]),
                Operation::new("Tf", vec!["F1".into(), 18.into()]),
                Operation::new("Td", vec![72.into(), 720.into()]),
                Operation::new("Tj", vec![Object::string_literal(text)]),
                Operation::new("ET", vec![]),
            ],
        };

        let content_id =
            document.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));

        document.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "Contents" => content_id,
            "Resources" => resources_id,
            "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
        })
    }
}
