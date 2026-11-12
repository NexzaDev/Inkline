pub const FORMAT_VERSION: u16 = 1;

pub const FILE_EXTENSION: &str = "graph";

pub const MIME_TYPE: &str = "application/vnd.nexza.inkline+xml";

pub const FORMAT_VERSION_ATTRIBUTE: &str = "inklineFormatVersion";

pub const MAX_DOCUMENT_BYTES: usize = 32 * 1024 * 1024;

pub const MAX_IMAGE_BYTES: usize = 8 * 1024 * 1024;

const _: () = assert!(MAX_IMAGE_BYTES < MAX_DOCUMENT_BYTES);

pub const fn is_supported_format_version(declared: u16) -> bool {
    declared >= 1 && declared <= FORMAT_VERSION
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn current_version_is_supported() {
        assert!(is_supported_format_version(FORMAT_VERSION));
    }

    #[test]
    fn older_versions_are_supported() {
        assert!(is_supported_format_version(1));
    }

    #[test]
    fn future_versions_are_rejected() {
        assert!(!is_supported_format_version(FORMAT_VERSION + 1));
        assert!(!is_supported_format_version(u16::MAX));
    }

    #[test]
    fn zero_is_rejected() {
        assert!(!is_supported_format_version(0));
    }
}
