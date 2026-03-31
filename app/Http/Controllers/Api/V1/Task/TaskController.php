<?php

namespace App\Http\Controllers\Api\V1\Task;

use App\Http\Controllers\Controller;
use App\Models\Column;
use App\Models\Task;
use App\Models\WorkspaceUser;
use App\Models\Board;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TaskController extends Controller
{
    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'board_id' => ['required', 'uuid', 'exists:boards,id'],
            'column_id' => ['required', 'uuid', 'exists:columns,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'assignee_id' => ['nullable', 'uuid', 'exists:users,id'],
            'due_at' => ['nullable', 'date'],
            'position' => ['nullable', 'integer', 'min:0'],
            'is_completed' => ['nullable', 'boolean'],
        ]);

        $board = Board::query()->find($validated['board_id']);
        if (! $board) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $column = Column::query()->find($validated['column_id']);
        if (! $column || $column->board_id !== $board->id) {
            return response()->json(['message' => 'Invalid column'], 422);
        }

        $isMember = WorkspaceUser::where('workspace_id', $board->workspace_id)
            ->where('user_id', $user->id)
            ->exists();

        if (! $isMember) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $isCompleted = (bool) ($validated['is_completed'] ?? false);

        $position = $validated['position'] ?? null;
        if ($position === null) {
            $position = Task::query()
                ->where('workspace_id', $board->workspace_id)
                ->where('board_id', $board->id)
                ->where('column_id', $column->id)
                ->where('is_completed', false)
                ->max('position');
            $position = ($position ?? 0) + 1;
        }

        $task = Task::query()->create([
            'workspace_id' => $board->workspace_id,
            'board_id' => $board->id,
            'column_id' => $column->id,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'assignee_id' => $validated['assignee_id'] ?? null,
            'due_at' => $validated['due_at'] ?? null,
            'is_completed' => $isCompleted,
            'position' => (int) $position,
        ]);

        return response()->json($task, 201);
    }

    public function update(Request $request, string $id)
    {
        $user = $request->user();

        $task = Task::query()->find($id);
        if (! $task) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $isMember = WorkspaceUser::where('workspace_id', $task->workspace_id)
            ->where('user_id', $user->id)
            ->exists();

        if (! $isMember) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'assignee_id' => ['nullable', 'uuid', 'exists:users,id'],
            'due_at' => ['nullable', 'date'],
            'is_completed' => ['nullable', 'boolean'],
            'column_id' => ['nullable', 'uuid', 'exists:columns,id'],
            'position' => ['nullable', 'integer', 'min:0'],
        ]);

        return DB::transaction(function () use ($task, $validated, $id) {
            // Берем сам таск через lockForUpdate для корректной конкурентности при drag & drop.
            /** @var Task $taskLocked */
            $taskLocked = Task::query()
                ->where('id', $id)
                ->lockForUpdate()
                ->first();

            if (! $taskLocked) {
                return response()->json(['message' => 'Not found'], 404);
            }

            $fromColumnId = $taskLocked->column_id;
            $fromPosition = (int) $taskLocked->position;

            $targetIsCompleted = array_key_exists('is_completed', $validated)
                ? (bool) $validated['is_completed']
                : (bool) $taskLocked->is_completed;

            $targetColumnId = array_key_exists('column_id', $validated) && $validated['column_id'] !== null
                ? (string) $validated['column_id']
                : (string) $taskLocked->column_id;

            $targetPosition = array_key_exists('position', $validated) && $validated['position'] !== null
                ? (int) $validated['position']
                : (int) $taskLocked->position;

            $movingActive = ! $taskLocked->is_completed && ! $targetIsCompleted;

            // Если меняем только текстовые поля или статус, reorder не делаем.
            if ($movingActive && ($targetColumnId !== $fromColumnId || $targetPosition !== $fromPosition)) {
                $toColumn = Column::query()
                    ->where('id', $targetColumnId)
                    ->lockForUpdate()
                    ->first();

                if (! $toColumn || $toColumn->workspace_id !== $taskLocked->workspace_id) {
                    return response()->json(['message' => 'Invalid column'], 422);
                }

                $toBoardId = $toColumn->board_id;

                if ($targetColumnId === $fromColumnId) {
                    // Переупорядочивание внутри одной колонки.
                    $min = min($fromPosition, $targetPosition);
                    $max = max($fromPosition, $targetPosition);

                    Task::query()
                        ->where('workspace_id', $taskLocked->workspace_id)
                        ->where('board_id', $taskLocked->board_id)
                        ->where('column_id', $fromColumnId)
                        ->where('is_completed', false)
                        ->whereBetween('position', [$min, $max])
                        ->lockForUpdate()
                        ->get();

                    if ($targetPosition > $fromPosition) {
                        Task::query()
                            ->where('workspace_id', $taskLocked->workspace_id)
                            ->where('board_id', $taskLocked->board_id)
                            ->where('column_id', $fromColumnId)
                            ->where('is_completed', false)
                            ->where('position', '>', $fromPosition)
                            ->where('position', '<=', $targetPosition)
                            ->decrement('position');
                    } else {
                        Task::query()
                            ->where('workspace_id', $taskLocked->workspace_id)
                            ->where('board_id', $taskLocked->board_id)
                            ->where('column_id', $fromColumnId)
                            ->where('is_completed', false)
                            ->where('position', '>=', $targetPosition)
                            ->where('position', '<', $fromPosition)
                            ->increment('position');
                    }

                    $taskLocked->position = $targetPosition;
                } else {
                    // Перемещение между колонками.
                    $fromBoardId = $taskLocked->board_id;

                    Task::query()
                        ->where('workspace_id', $taskLocked->workspace_id)
                        ->where('board_id', $fromBoardId)
                        ->where('column_id', $fromColumnId)
                        ->where('is_completed', false)
                        ->where('position', '>', $fromPosition)
                        ->lockForUpdate()
                        ->get();

                    Task::query()
                        ->where('workspace_id', $taskLocked->workspace_id)
                        ->where('board_id', $toBoardId)
                        ->where('column_id', $targetColumnId)
                        ->where('is_completed', false)
                        ->where('position', '>=', $targetPosition)
                        ->lockForUpdate()
                        ->get();

                    // "Вынимаем" из старой колонки: двигаем вниз.
                    Task::query()
                        ->where('workspace_id', $taskLocked->workspace_id)
                        ->where('board_id', $fromBoardId)
                        ->where('column_id', $fromColumnId)
                        ->where('is_completed', false)
                        ->where('position', '>', $fromPosition)
                        ->decrement('position');

                    // "Вставляем" в новую колонку: сдвигаем вверх.
                    Task::query()
                        ->where('workspace_id', $taskLocked->workspace_id)
                        ->where('board_id', $toBoardId)
                        ->where('column_id', $targetColumnId)
                        ->where('is_completed', false)
                        ->where('position', '>=', $targetPosition)
                        ->increment('position');

                    $taskLocked->column_id = $targetColumnId;
                    $taskLocked->board_id = $toBoardId;
                    $taskLocked->position = $targetPosition;
                }
            }

            // Обновляем остальные поля.
            if (array_key_exists('title', $validated)) {
                $taskLocked->title = $validated['title'];
            }
            if (array_key_exists('description', $validated)) {
                $taskLocked->description = $validated['description'];
            }
            if (array_key_exists('assignee_id', $validated)) {
                $taskLocked->assignee_id = $validated['assignee_id'];
            }
            if (array_key_exists('due_at', $validated)) {
                $taskLocked->due_at = $validated['due_at'];
            }
            if (array_key_exists('is_completed', $validated)) {
                $taskLocked->is_completed = (bool) $validated['is_completed'];
            }

            // Если column_id пришёл, но reorder не делали (например, task становится completed),
            // применяем смену колонки/борда без перестановок.
            if (array_key_exists('column_id', $validated) && $validated['column_id'] !== null && ! $movingActive) {
                $toColumn = Column::query()
                    ->where('id', $validated['column_id'])
                    ->first();

                if ($toColumn && $toColumn->workspace_id === $taskLocked->workspace_id) {
                    $taskLocked->column_id = $toColumn->id;
                    $taskLocked->board_id = $toColumn->board_id;
                }
            }

            $taskLocked->save();

            return response()->json($taskLocked);
        });
    }

    public function destroy(Request $request, string $id)
    {
        $user = $request->user();

        $task = Task::query()->find($id);
        if (! $task) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $isMember = WorkspaceUser::where('workspace_id', $task->workspace_id)
            ->where('user_id', $user->id)
            ->exists();

        if (! $isMember) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $task->delete();

        return response()->json(['message' => 'Task deleted']);
    }
}

