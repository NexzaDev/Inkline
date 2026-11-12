use std::num::ParseIntError;

use thiserror::Error;

use crate::format::MAX_DOCUMENT_BYTES;

#[derive(Debug, Error)]
pub enum GraphError {
    #[error("document is {actual} bytes, above the {limit} byte limit")]
    DocumentTooLarge { actual: usize, limit: usize },

    #[error("embedded image is {actual} bytes, above the {limit} byte limit")]
    ImageTooLarge { actual: usize, limit: usize },

    #[error("format version attribute is not a number: {value}")]
    MalformedFormatVersion {
        value: String,
        #[source]
        source: ParseIntError,
    },

    #[error("format version {declared} is newer than this build supports")]
    UnsupportedFormatVersion { declared: u16 },
}

impl GraphError {
    pub fn document_limit_exceeded(actual: usize) -> Self {
        Self::DocumentTooLarge {
            actual,
            limit: MAX_DOCUMENT_BYTES,
        }
    }

    pub fn malformed_format_version(value: String, source: ParseIntError) -> Self {
        Self::MalformedFormatVersion { value, source }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn document_limit_message_reports_both_numbers() {
        let message = GraphError::document_limit_exceeded(MAX_DOCUMENT_BYTES + 1).to_string();

        assert!(message.contains(&(MAX_DOCUMENT_BYTES + 1).to_string()));
        assert!(message.contains(&MAX_DOCUMENT_BYTES.to_string()));
    }

    #[test]
    fn unsupported_version_message_names_the_version() {
        let message = GraphError::UnsupportedFormatVersion { declared: 7 }.to_string();

        assert!(message.contains('7'));
    }
}
