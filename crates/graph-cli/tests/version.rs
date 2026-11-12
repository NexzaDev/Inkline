use std::process::Command;

fn graphctl() -> Command {
    Command::new(env!("CARGO_BIN_EXE_graphctl"))
}

#[test]
fn version_json_is_machine_readable() {
    let output = graphctl()
        .args(["--json", "version"])
        .output()
        .expect("graphctl runs");

    assert!(output.status.success());

    let stdout = String::from_utf8(output.stdout).expect("stdout is utf-8");
    let parsed: serde_json::Value = serde_json::from_str(stdout.trim()).expect("stdout is json");

    assert_eq!(parsed["tool"], "graphctl");
    assert_eq!(parsed["graph_format_version"], 1);
}

#[test]
fn version_text_names_the_tool() {
    let output = graphctl().arg("version").output().expect("graphctl runs");

    assert!(output.status.success());

    let stdout = String::from_utf8(output.stdout).expect("stdout is utf-8");

    assert!(stdout.starts_with("graphctl "));
}

#[test]
fn unknown_subcommand_fails() {
    let output = graphctl().arg("teleport").output().expect("graphctl runs");

    assert!(!output.status.success());
}
