<?php

namespace App\Http\Controllers\Api\V1\Board;

use App\Http\Controllers\Controller;
use App\Models\Board;
use App\Models\WorkspaceUser;
use Illuminate\Http\Request;

class BoardController extends Controller
{
    public function indexByWorkspace(Request $request, string $workspace)
    {
        $user = $request->user();

        $isMember = WorkspaceUser::where('workspace_id', $workspace)
            ->where('user_id', $user->id)
            ->exists();

        if (! $isMember) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $boards = Board::query()
            ->where('workspace_id', $workspace)
            ->where('is_archived', false)
            ->orderBy('position')
            ->get();

        return response()->json($boards);
    }

    public function show(Request $request, string $id)
    {
        $user = $request->user();

        $board = Board::query()->find($id);
        if (! $board) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $isMember = WorkspaceUser::where('workspace_id', $board->workspace_id)
            ->where('user_id', $user->id)
            ->exists();

        if (! $isMember) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

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

        $role = WorkspaceUser::where('workspace_id', $validated['workspace_id'])
            ->where('user_id', $user->id)
            ->value('role');

        if (! $role) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Создание досок разрешено всем ролям из ТЗ.
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

        return response()->json($board, 201);
    }

    public function destroy(Request $request, string $id)
    {
        $user = $request->user();

        $board = Board::query()->find($id);
        if (! $board) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $role = WorkspaceUser::where('workspace_id', $board->workspace_id)
            ->where('user_id', $user->id)
            ->value('role');

        if (! $role) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // В ТЗ удаление досок: Owner/Admin ✅, Member ❌
        if (! in_array($role, ['owner', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $board->update(['is_archived' => true]);

        return response()->json(['message' => 'Board archived']);
    }
}

