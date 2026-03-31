<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspaces', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('owner_id');
            $table->string('name');
            $table->string('type', 20); // personal, team
            $table->timestamps();

            $table->foreign('owner_id')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();

            $table->index(['owner_id', 'type']);
        });

        // CHECK constraint for type
        DB::statement("
            ALTER TABLE workspaces
            ADD CONSTRAINT workspaces_type_check
            CHECK (type IN ('personal', 'team'))
        ");

        // Partial index: один personal workspace на пользователя
        DB::statement("
            CREATE UNIQUE INDEX workspaces_owner_personal_unique
            ON workspaces (owner_id)
            WHERE type = 'personal'
        ");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS workspaces_owner_personal_unique');
        DB::statement('ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_type_check');

        Schema::dropIfExists('workspaces');
    }
};

