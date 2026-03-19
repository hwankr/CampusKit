use crate::platform::pathing::{build_output_filename, default_base_name_from_path};
use lopdf::Document;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

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
        let destination = output_dir.join(file_name);
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
    use lopdf::content::{Content, Operation};
    use lopdf::{dictionary, Document, Object, Stream};
    use super::{validate_segments, SplitSegment};
    use crate::platform::pathing::{build_output_filename, default_base_name_from_path};
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};
    use super::{get_pdf_metadata, PdfMetadataRequest};

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
        write_sample_pdf(&file_path);

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

    fn build_temp_pdf_path() -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("campuskit-metadata-{timestamp}.pdf"))
    }

    fn write_sample_pdf(path: &Path) {
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

        let content = Content {
            operations: vec![
                Operation::new("BT", vec![]),
                Operation::new("Tf", vec!["F1".into(), 18.into()]),
                Operation::new("Td", vec![72.into(), 720.into()]),
                Operation::new("Tj", vec![Object::string_literal("CampusKit PDF metadata test")]),
                Operation::new("ET", vec![]),
            ],
        };

        let content_id = document.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
        let page_id = document.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "Contents" => content_id,
            "Resources" => resources_id,
            "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
        });

        document.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![page_id.into()],
                "Count" => 1,
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
}
