<?php

namespace App\Http\Controllers\Api\V1\Board;

use App\Http\Controllers\Controller;
use App\Models\Board;
use App\Models\Workspace;
use App\Jobs\LogActivity;
use Illuminate\Http\Request;

class BoardController extends Controller
{
    public function indexByWorkspace(Request $request, string $workspace)
    {
        $boards = Board::query()
            ->where('workspace_id', $workspace)
            ->where('is_archived', false)
            ->orderBy('position')
            ->get();

        return response()->json($boards);
    }

    public function show(Request $request, string $id)
    {
        $board = Board::query()->find($id);
        if (! $board) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $this->authorize('view', $board);

        return response()->json($board);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'workspace_id' => ['required', 'uuid', 'exists:workspaces,id'],
            'name' => ['required', 'string', 'max:255'],
            'position' => ['nullable', 'integer', 'min:0'],
        ]);

        $workspace = Workspace::query()->findOrFail($validated['workspace_id']);

        $this->authorize('create', [Board::class, $workspace]);
        $position = $validated['position'] ?? Board::query()
            ->where('workspace_id', $validated['workspace_id'])
            ->max('position');
        $position = ($position ?? 0) + 1;

        $board = Board::query()->create([
            'workspace_id' => $validated['workspace_id'],
            'name' => $validated['name'],
            'position' => $validated['position'] ?? $position,
            'is_archived' => false,
        ]);

        LogActivity::dispatch(
            workspaceId: $workspace->id,
            userId: $user->id,
            action: 'board.created',
            metadata: [
                'board_id' => $board->id,
                'name' => $board->name,
            ],
        );

        return response()->json($board, 201);
    }

    public function destroy(Request $request, string $id)
    {
        $board = Board::query()->find($id);
        if (! $board) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $this->authorize('delete', $board);

        $board->update(['is_archived' => true]);

        LogActivity::dispatch(
            workspaceId: $board->workspace_id,
            userId: $request->user()?->id,
            action: 'board.archived',
            metadata: [
                'board_id' => $board->id,
                'name' => $board->name,
            ],
        );

        return response()->json(['message' => 'Board archived']);
    }
}

