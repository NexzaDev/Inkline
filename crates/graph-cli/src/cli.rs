use clap::{Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(
    name = "graphctl",
    version,
    about = "Validate, format and convert Inkline .graph documents",
    disable_help_subcommand = true
)]
pub struct Cli {
    #[arg(long, global = true, help = "Print machine-readable JSON")]
    pub json: bool,

    #[command(subcommand)]
    pub command: Command,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    #[command(about = "Print tool and format versions")]
    Version,
}
