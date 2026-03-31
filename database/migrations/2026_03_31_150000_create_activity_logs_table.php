<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workspace_id');
            $table->uuid('user_id')->nullable();
            $table->string('action');
            $table->jsonb('metadata')->nullable();
            $table->timestampTz('created_at')->useCurrent();

            $table->foreign('workspace_id')
                ->references('id')
                ->on('workspaces')
                ->cascadeOnDelete();

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
        });

        DB::statement('CREATE INDEX activity_logs_workspace_action_idx ON activity_logs (workspace_id, action)');
        DB::statement('CREATE INDEX activity_logs_metadata_gin_idx ON activity_logs USING GIN (metadata)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS activity_logs_metadata_gin_idx');
        DB::statement('DROP INDEX IF EXISTS activity_logs_workspace_action_idx');

        Schema::dropIfExists('activity_logs');
    }
};

