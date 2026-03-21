using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEvaluationToVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "evaluated_at",
                table: "prompt_entry_versions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "evaluation",
                table: "prompt_entry_versions",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "evaluation_average_score",
                table: "prompt_entry_versions",
                type: "double precision",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "evaluated_at",
                table: "prompt_entry_versions");

            migrationBuilder.DropColumn(
                name: "evaluation",
                table: "prompt_entry_versions");

            migrationBuilder.DropColumn(
                name: "evaluation_average_score",
                table: "prompt_entry_versions");
        }
    }
}
