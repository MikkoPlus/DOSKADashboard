<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workspace_id');
            $table->uuid('board_id');
            $table->uuid('column_id');
            $table->string('title');
            $table->text('description')->nullable();
            $table->uuid('assignee_id')->nullable();
            $table->timestampTz('due_at')->nullable();
            $table->boolean('is_completed')->default(false);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->foreign('workspace_id')
                ->references('id')
                ->on('workspaces')
                ->cascadeOnDelete();

            $table->foreign('board_id')
                ->references('id')
                ->on('boards')
                ->cascadeOnDelete();

            $table->foreign('column_id')
                ->references('id')
                ->on('columns')
                ->cascadeOnDelete();

            $table->foreign('assignee_id')
                ->references('id')
                ->on('users')
                ->nullOnDelete();

            $table->index(['workspace_id', 'board_id', 'column_id']);
        });

        // Partial index для активных задач (используем при выборках доски)
        DB::statement("
            CREATE INDEX tasks_active_position_index
            ON tasks (workspace_id, board_id, column_id, position)
            WHERE is_completed = false
        ");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS tasks_active_position_index');

        Schema::dropIfExists('tasks');
    }
};

