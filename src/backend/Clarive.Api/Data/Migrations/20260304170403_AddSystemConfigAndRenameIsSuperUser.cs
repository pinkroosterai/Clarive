using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Clarive.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemConfigAndRenameIsSuperUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "IsSuperUser",
                table: "users",
                newName: "is_super_user");

            migrationBuilder.AlterColumn<bool>(
                name: "is_super_user",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "boolean");

            migrationBuilder.CreateTable(
                name: "system_config",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    maintenance_enabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    maintenance_since = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    maintenance_by = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_system_config", x => x.id);
                });

            migrationBuilder.InsertData(
                table: "system_config",
                columns: new[] { "id", "maintenance_by", "maintenance_since" },
                values: new object[] { 1, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "system_config");

            migrationBuilder.RenameColumn(
                name: "is_super_user",
                table: "users",
                newName: "IsSuperUser");

            migrationBuilder.AlterColumn<bool>(
                name: "IsSuperUser",
                table: "users",
                type: "boolean",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "boolean",
                oldDefaultValue: false);
        }
    }
}
