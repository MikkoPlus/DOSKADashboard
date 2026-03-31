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

