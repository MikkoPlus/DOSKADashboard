<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspace_user', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workspace_id');
            $table->uuid('user_id');
            $table->string('role', 20); // owner, admin, member
            $table->timestamps();

            $table->foreign('workspace_id')
                ->references('id')
                ->on('workspaces')
                ->cascadeOnDelete();

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();

            $table->unique(['workspace_id', 'user_id']);
            $table->index(['user_id', 'role']);
        });

        DB::statement("
            ALTER TABLE workspace_user
            ADD CONSTRAINT workspace_user_role_check
            CHECK (role IN ('owner', 'admin', 'member'))
        ");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE workspace_user DROP CONSTRAINT IF EXISTS workspace_user_role_check');

        Schema::dropIfExists('workspace_user');
    }
};

