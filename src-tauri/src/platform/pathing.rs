use std::path::Path;

pub fn default_base_name_from_path(path: &Path) -> String {
    path.file_stem()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "split".to_string())
}

pub fn build_output_filename(base_name: &str, label: &str, index: usize) -> String {
    let safe_base = sanitize_file_component(base_name);
    let safe_label = sanitize_file_component(label);

    format!(
        "{}-part-{:02}-pages-{}.pdf",
        safe_base,
        index + 1,
        safe_label
    )
}

fn sanitize_file_component(value: &str) -> String {
    let normalized = value
        .trim()
        .chars()
        .map(|character| match character {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            ' ' => '-',
            other => other,
        })
        .collect::<String>();

    let collapsed = normalized
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<&str>>()
        .join("-");

    if collapsed.is_empty() {
        "split".to_string()
    } else {
        collapsed
    }
}
