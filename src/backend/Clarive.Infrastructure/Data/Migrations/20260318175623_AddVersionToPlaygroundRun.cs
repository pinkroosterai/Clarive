using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVersionToPlaygroundRun : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "VersionLabel",
                table: "playground_runs",
                type: "text",
                nullable: true
            );

            migrationBuilder.AddColumn<int>(
                name: "VersionNumber",
                table: "playground_runs",
                type: "integer",
                nullable: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "VersionLabel", table: "playground_runs");

            migrationBuilder.DropColumn(name: "VersionNumber", table: "playground_runs");
        }
    }
}
