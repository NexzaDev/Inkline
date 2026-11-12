use serde::Serialize;

const APPLICATION_IDENTIFIER: &str = "dev.nexza.inkline";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: &'static str,
    version: &'static str,
    graph_format_version: u16,
    identifier: &'static str,
}

#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        name: "Inkline",
        version: env!("CARGO_PKG_VERSION"),
        graph_format_version: graph_core::FORMAT_VERSION,
        identifier: APPLICATION_IDENTIFIER,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("inkline: the application runtime stopped: {error}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_reports_the_format_version() {
        let info = app_info();

        assert_eq!(info.name, "Inkline");
        assert_eq!(info.graph_format_version, graph_core::FORMAT_VERSION);
        assert_eq!(info.identifier, APPLICATION_IDENTIFIER);
    }

    #[test]
    fn app_info_serialises_to_camel_case() {
        let json = serde_json::to_string(&app_info()).expect("app info serialises");

        assert!(json.contains("\"graphFormatVersion\""));
        assert!(!json.contains("\"graph_format_version\""));
    }
}
