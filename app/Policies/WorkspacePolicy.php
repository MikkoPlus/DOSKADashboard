<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceUser;

class WorkspacePolicy
{
    public function view(User $user, Workspace $workspace): bool
    {
        return $this->role($user, $workspace) !== null;
    }

    public function manage(User $user, Workspace $workspace): bool
    {
        // Управление workspace – только owner
        return $this->role($user, $workspace) === 'owner';
    }

    public function manageMembers(User $user, Workspace $workspace): bool
    {
        // Управление участниками – owner и admin
        return in_array($this->role($user, $workspace), ['owner', 'admin'], true);
    }

    private function role(User $user, Workspace $workspace): ?string
    {
        return WorkspaceUser::query()
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $user->id)
            ->value('role');
    }
}

