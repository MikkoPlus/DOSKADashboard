<?php

namespace App\Http\Controllers\Api\V1\Column;

use App\Http\Controllers\Controller;
use App\Models\Column;
use App\Models\WorkspaceUser;
use App\Models\Board;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ColumnController extends Controller
{
    public function indexByBoard(Request $request, string $boardId)
    {
        $board = Board::query()->find($boardId);
        if (! $board) {
            return response()->json(['message' => 'Not found'], 404);
        }

        // доступ к workspace уже проверяется в middleware/policies на уровне других операций,
        // здесь просто возвращаем колонки доски
        $columns = Column::query()
            ->where('board_id', $board->id)
            ->orderBy('position')
            ->get();

        return response()->json($columns);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'board_id' => ['required', 'uuid', 'exists:boards,id'],
            'name' => ['required', 'string', 'max:255'],
            'position' => ['nullable', 'integer', 'min:0'],
        ]);

        $board = Board::query()->find($validated['board_id']);
        if (! $board) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $isMember = WorkspaceUser::where('workspace_id', $board->workspace_id)
            ->where('user_id', $user->id)
            ->exists();

        if (! $isMember) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $position = $validated['position'] ?? Column::query()
            ->where('board_id', $board->id)
            ->max('position');
        $position = ($position ?? 0) + 1;

        $column = Column::query()->create([
            'workspace_id' => $board->workspace_id,
            'board_id' => $board->id,
            'name' => $validated['name'],
            'position' => $position,
        ]);

        return response()->json($column, 201);
    }

    public function reorderByBoard(Request $request, string $boardId)
    {
        $user = $request->user();

        $board = Board::query()->find($boardId);
        if (! $board) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $isMember = WorkspaceUser::where('workspace_id', $board->workspace_id)
            ->where('user_id', $user->id)
            ->exists();

        if (! $isMember) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'column_ids' => ['required', 'array', 'min:1'],
            'column_ids.*' => ['required', 'uuid'],
        ]);

        $orderedIds = $validated['column_ids'];

        return DB::transaction(function () use ($board, $orderedIds) {
            $columns = Column::query()
                ->where('board_id', $board->id)
                ->lockForUpdate()
                ->get(['id', 'position']);

            $existingIds = $columns->pluck('id')->all();
            sort($existingIds);

            $incomingIds = $orderedIds;
            sort($incomingIds);

            if ($existingIds !== $incomingIds) {
                return response()->json(['message' => 'Invalid columns order payload'], 422);
            }

            $count = count($orderedIds);
            $offset = $count + 1000;

            // Шаг 1: уводим все позиции в безопасный диапазон, чтобы не нарушить unique(board_id, position)
            foreach ($orderedIds as $index => $columnId) {
                Column::query()
                    ->where('id', $columnId)
                    ->update(['position' => $offset + $index + 1]);
            }

            // Шаг 2: выставляем целевые позиции
            foreach ($orderedIds as $index => $columnId) {
                Column::query()
                    ->where('id', $columnId)
                    ->update(['position' => $index + 1]);
            }

            $result = Column::query()
                ->where('board_id', $board->id)
                ->orderBy('position')
                ->get();

            return response()->json($result);
        });
    }

    public function update(Request $request, string $id)
    {
        $user = $request->user();

        $column = Column::query()->find($id);
        if (! $column) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $isMember = WorkspaceUser::where('workspace_id', $column->workspace_id)
            ->where('user_id', $user->id)
            ->exists();

        if (! $isMember) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'position' => ['nullable', 'integer', 'min:0'],
        ]);

        return DB::transaction(function () use ($column, $validated) {
            /** @var Column $columnLocked */
            $columnLocked = Column::query()
                ->where('id', $column->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (array_key_exists('name', $validated)) {
                $columnLocked->name = $validated['name'];
            }

            if (array_key_exists('position', $validated) && $validated['position'] !== null) {
                $oldPosition = (int) $columnLocked->position;
                $newPosition = (int) $validated['position'];

                if ($newPosition !== $oldPosition) {
                    // Блокируем строки в нужном диапазоне, чтобы корректно переставить position.
                    $min = min($oldPosition, $newPosition);
                    $max = max($oldPosition, $newPosition);

                    Column::query()
                        ->where('board_id', $columnLocked->board_id)
                        ->whereBetween('position', [$min, $max])
                        ->lockForUpdate()
                        ->get();

                    // Важно для PostgreSQL unique(board_id, position):
                    // временно освобождаем старую позицию, чтобы избежать промежуточных конфликтов.
                    $columnLocked->position = 0;
                    $columnLocked->save();

                    if ($newPosition > $oldPosition) {
                        Column::query()
                            ->where('board_id', $columnLocked->board_id)
                            ->where('position', '>', $oldPosition)
                            ->where('position', '<=', $newPosition)
                            ->decrement('position');
                    } else {
                        Column::query()
                            ->where('board_id', $columnLocked->board_id)
                            ->where('position', '>=', $newPosition)
                            ->where('position', '<', $oldPosition)
                            ->increment('position');
                    }

                    $columnLocked->position = $newPosition;
                }
            }

            $columnLocked->save();

            return response()->json($columnLocked);
        });
    }

    public function destroy(Request $request, string $id)
    {
        $user = $request->user();

        $column = Column::query()->find($id);
        if (! $column) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $isMember = WorkspaceUser::where('workspace_id', $column->workspace_id)
            ->where('user_id', $user->id)
            ->exists();

        if (! $isMember) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $column->delete();

        return response()->json(['message' => 'Column deleted']);
    }
}

