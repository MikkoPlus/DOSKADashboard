<?php

namespace App\Http\Middleware;

use App\Models\Workspace;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CurrentWorkspace
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $workspaceId = $request->route('workspace')
            ?? $request->route('workspace_id')
            ?? $request->input('workspace_id');

        if (! $workspaceId) {
            return $next($request);
        }

        $workspace = Workspace::query()->find($workspaceId);

        if (! $workspace) {
            return response()->json(['message' => 'Workspace not found'], 404);
        }

        $request->attributes->set('current_workspace', $workspace);

        return $next($request);
    }
}

