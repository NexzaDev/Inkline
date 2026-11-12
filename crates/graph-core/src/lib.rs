#![forbid(unsafe_code)]

mod error;
mod format;
mod report;

pub use error::GraphError;
pub use format::{
    is_supported_format_version, FILE_EXTENSION, FORMAT_VERSION, FORMAT_VERSION_ATTRIBUTE,
    MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES, MIME_TYPE,
};
pub use report::{Finding, Severity, ValidationReport};
