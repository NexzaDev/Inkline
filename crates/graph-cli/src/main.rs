#![forbid(unsafe_code)]

mod cli;
mod info;

use std::process::ExitCode;

use clap::Parser;

use crate::cli::{Cli, Command};

fn main() -> ExitCode {
    let cli = Cli::parse();

    match cli.command {
        Command::Version => {
            let info = info::ToolInfo::current();
            let rendered = if cli.json {
                info.to_json()
            } else {
                info.to_text()
            };

            println!("{rendered}");
            ExitCode::SUCCESS
        }
    }
}
