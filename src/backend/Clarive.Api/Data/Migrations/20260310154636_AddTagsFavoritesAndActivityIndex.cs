using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clarive.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTagsFavoritesAndActivityIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "entry_favorites",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entry_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entry_favorites", x => x.id);
                    table.ForeignKey(
                        name: "FK_entry_favorites_prompt_entries_entry_id",
                        column: x => x.entry_id,
                        principalTable: "prompt_entries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade
                    );
                    table.ForeignKey(
                        name: "FK_entry_favorites_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade
                    );
                    table.ForeignKey(
                        name: "FK_entry_favorites_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "entry_tags",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entry_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tag_name = table.Column<string>(
                        type: "character varying(50)",
                        maxLength: 50,
                        nullable: false
                    ),
                    created_at = table.Column<DateTime>(
                        type: "timestamp with time zone",
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_entry_tags", x => x.id);
                    table.ForeignKey(
                        name: "FK_entry_tags_prompt_entries_entry_id",
                        column: x => x.entry_id,
                        principalTable: "prompt_entries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade
                    );
                    table.ForeignKey(
                        name: "FK_entry_tags_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_tenant_entity_timestamp",
                table: "audit_log_entries",
                columns: new[] { "tenant_id", "entity_id", "timestamp" },
                descending: new[] { false, false, true }
            );

            migrationBuilder.CreateIndex(
                name: "IX_entry_favorites_entry_id",
                table: "entry_favorites",
                column: "entry_id"
            );

            migrationBuilder.CreateIndex(
                name: "IX_entry_favorites_tenant_id",
                table: "entry_favorites",
                column: "tenant_id"
            );

            migrationBuilder.CreateIndex(
                name: "ix_entry_favorites_user_tenant_created",
                table: "entry_favorites",
                columns: new[] { "user_id", "tenant_id", "created_at" }
            );

            migrationBuilder.CreateIndex(
                name: "uq_entry_favorites_user_tenant_entry",
                table: "entry_favorites",
                columns: new[] { "user_id", "tenant_id", "entry_id" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_entry_tags_entry_id",
                table: "entry_tags",
                column: "entry_id"
            );

            migrationBuilder.CreateIndex(
                name: "ix_entry_tags_tenant_entry",
                table: "entry_tags",
                columns: new[] { "tenant_id", "entry_id" }
            );

            migrationBuilder.CreateIndex(
                name: "ix_entry_tags_tenant_tag",
                table: "entry_tags",
                columns: new[] { "tenant_id", "tag_name" }
            );

            migrationBuilder.CreateIndex(
                name: "uq_entry_tags_tenant_entry_tag",
                table: "entry_tags",
                columns: new[] { "tenant_id", "entry_id", "tag_name" },
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "entry_favorites");

            migrationBuilder.DropTable(name: "entry_tags");

            migrationBuilder.DropIndex(
                name: "ix_audit_log_tenant_entity_timestamp",
                table: "audit_log_entries"
            );
        }
    }
}
