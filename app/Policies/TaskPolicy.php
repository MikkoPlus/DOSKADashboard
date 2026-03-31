<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceUser;

class TaskPolicy
{
    public function create(User $user, Workspace $workspace): bool
    {
        // Любой участник workspace может создавать задачи
        return $this->role($user, $workspace) !== null;
    }

    public function update(User $user, Task $task): bool
    {
        return $this->roleForWorkspaceId($user, $task->workspace_id) !== null;
    }

    public function delete(User $user, Task $task): bool
    {
        return $this->roleForWorkspaceId($user, $task->workspace_id) !== null;
    }

    private function role(User $user, Workspace $workspace): ?string
    {
        return $this->roleForWorkspaceId($user, $workspace->id);
    }

    private function roleForWorkspaceId(User $user, string $workspaceId): ?string
    {
        return WorkspaceUser::query()
            ->where('workspace_id', $workspaceId)
            ->where('user_id', $user->id)
            ->value('role');
    }
}

