<?php

namespace App\Http\Controllers\Api\V1\Workspace;

use App\Http\Controllers\Controller;
use App\Models\Workspace;
use Illuminate\Http\Request;

class WorkspaceController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $workspaces = Workspace::query()
            ->select('workspaces.*')
            ->join('workspace_user', 'workspace_user.workspace_id', '=', 'workspaces.id')
            ->where('workspace_user.user_id', $user->id)
            ->orderBy('workspaces.created_at')
            ->get();

        return response()->json($workspaces);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $workspace = Workspace::query()->create([
            'owner_id' => $user->id,
            'name' => $validated['name'],
            'type' => 'team',
        ]);

        $workspace->users()->attach($user->id, ['role' => 'owner']);

        return response()->json($workspace, 201);
    }

    public function show(Request $request, Workspace $workspace)
    {
        $user = $request->user();

        $isMember = $workspace->users()
            ->where('users.id', $user->id)
            ->exists();

        if (! $isMember) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($workspace);
    }
}

