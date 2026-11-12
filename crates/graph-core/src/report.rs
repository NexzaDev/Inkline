use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Finding {
    pub severity: Severity,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cell_id: Option<String>,
    pub message: String,
}

impl Finding {
    pub fn error(message: impl Into<String>) -> Self {
        Self {
            severity: Severity::Error,
            cell_id: None,
            message: message.into(),
        }
    }

    pub fn warning(message: impl Into<String>) -> Self {
        Self {
            severity: Severity::Warning,
            cell_id: None,
            message: message.into(),
        }
    }

    pub fn on_cell(mut self, cell_id: impl Into<String>) -> Self {
        self.cell_id = Some(cell_id.into());
        self
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct ValidationReport {
    findings: Vec<Finding>,
}

impl ValidationReport {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn from_findings(findings: Vec<Finding>) -> Self {
        Self { findings }
    }

    pub fn push(&mut self, finding: Finding) {
        self.findings.push(finding);
    }

    pub fn findings(&self) -> &[Finding] {
        &self.findings
    }

    pub fn errors(&self) -> impl Iterator<Item = &Finding> {
        self.findings
            .iter()
            .filter(|finding| finding.severity == Severity::Error)
    }

    pub fn error_count(&self) -> usize {
        self.errors().count()
    }

    pub fn is_valid(&self) -> bool {
        self.error_count() == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_report_is_valid() {
        assert!(ValidationReport::new().is_valid());
    }

    #[test]
    fn warnings_do_not_invalidate() {
        let mut report = ValidationReport::new();
        report.push(Finding::warning("connector has a single waypoint"));

        assert!(report.is_valid());
        assert_eq!(report.error_count(), 0);
    }

    #[test]
    fn errors_invalidate_and_count() {
        let mut report = ValidationReport::new();
        report.push(Finding::error("duplicate cell id").on_cell("n3"));
        report.push(Finding::error("edge points to a missing cell"));

        assert!(!report.is_valid());
        assert_eq!(report.error_count(), 2);
        assert_eq!(report.findings().len(), 2);
    }

    #[test]
    fn serialised_report_uses_stable_severity_names() {
        let report = ValidationReport::from_findings(vec![
            Finding::error("duplicate cell id").on_cell("n3"),
            Finding::warning("empty page"),
        ]);

        let json = serde_json::to_string(&report).expect("report serialises");

        assert_eq!(
            json,
            r#"{"findings":[{"severity":"error","cell_id":"n3","message":"duplicate cell id"},{"severity":"warning","message":"empty page"}]}"#
        );
    }
}
