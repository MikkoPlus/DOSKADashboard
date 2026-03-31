<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Workspace;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $user = User::factory()->create([
            'name' => 'Demo User',
            'email' => 'demo@example.com',
        ]);

        /** @var Workspace $workspace */
        $workspace = Workspace::createPersonalForUser($user);

        /** @var Board $board */
        $board = Board::query()->create([
            'workspace_id' => $workspace->id,
            'name' => 'Demo Board',
            'position' => 1,
            'is_archived' => false,
        ]);

        $columnNames = ['Backlog', 'In Progress', 'Review', 'Done'];

        $columns = collect($columnNames)->map(function (string $name, int $index) use ($workspace, $board) {
            return Column::query()->create([
                'workspace_id' => $workspace->id,
                'board_id' => $board->id,
                'name' => $name,
                'position' => $index + 1,
            ]);
        });

        $titles = [
            'Настроить Docker окружение',
            'Добавить регистрацию и логин',
            'Реализовать доски и колонки',
            'Сделать drag & drop задач',
            'Добавить RBAC через Policies',
            'Подключить Redis и очереди',
            'Реализовать Activity Log',
            'Написать feature-тесты API',
            'Сделать оптимизированный запрос всей доски',
            'Подготовить README для проекта',
        ];

        $titles = array_map(function (string $title) {
            return Str::limit($title, 120, '');
        }, $titles);

        $columnsArray = $columns->values()->all();
        $columnsCount = count($columnsArray);

        foreach ($titles as $index => $title) {
            /** @var Column $column */
            $column = $columnsArray[$index % $columnsCount];

            Task::query()->create([
                'workspace_id' => $workspace->id,
                'board_id' => $board->id,
                'column_id' => $column->id,
                'title' => $title,
                'description' => null,
                'assignee_id' => $user->id,
                'due_at' => now()->addDays($index + 1),
                'is_completed' => $column->name === 'Done',
                'position' => $index + 1,
            ]);
        }
    }
}
