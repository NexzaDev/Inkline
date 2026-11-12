use graph_core::{FILE_EXTENSION, FORMAT_VERSION, MIME_TYPE};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ToolInfo {
    pub tool: &'static str,
    pub version: &'static str,
    pub graph_format_version: u16,
    pub file_extension: &'static str,
    pub mime_type: &'static str,
}

impl ToolInfo {
    pub fn current() -> Self {
        Self {
            tool: "graphctl",
            version: env!("CARGO_PKG_VERSION"),
            graph_format_version: FORMAT_VERSION,
            file_extension: FILE_EXTENSION,
            mime_type: MIME_TYPE,
        }
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(self).expect("tool info has no fallible fields")
    }

    pub fn to_text(&self) -> String {
        format!(
            "{} {}\ngraph format version {}\nfile extension .{}\nmime type {}",
            self.tool, self.version, self.graph_format_version, self.file_extension, self.mime_type
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_contains_format_version() {
        let json = ToolInfo::current().to_json();

        assert!(json.contains("\"graph_format_version\":1"));
        assert!(json.contains("\"mime_type\":\"application/vnd.nexza.inkline+xml\""));
    }

    #[test]
    fn text_names_tool_and_version() {
        let text = ToolInfo::current().to_text();

        assert!(text.starts_with("graphctl "));
        assert!(text.contains("graph format version 1"));
    }
}
