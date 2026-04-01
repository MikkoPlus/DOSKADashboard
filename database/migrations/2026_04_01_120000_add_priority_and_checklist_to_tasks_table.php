<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->string('priority', 16)->default('normal')->after('description');
            $table->json('checklist')->nullable()->after('priority');
        });

        DB::statement("
            ALTER TABLE tasks
            ADD CONSTRAINT tasks_priority_check
            CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
        ");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check');

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn(['priority', 'checklist']);
        });
    }
};
