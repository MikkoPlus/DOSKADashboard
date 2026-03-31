<?php

namespace App\Policies;

use App\Models\Board;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceUser;

class BoardPolicy
{
    public function view(User $user, Board $board): bool
    {
        return $this->role($user, $board->workspace) !== null;
    }

    public function create(User $user, Workspace $workspace): bool
    {
        // Создавать доски могут все роли (owner, admin, member)
        return $this->role($user, $workspace) !== null;
    }

    public function delete(User $user, Board $board): bool
    {
        // Удалять (архивировать) доски могут owner и admin
        return in_array($this->role($user, $board->workspace), ['owner', 'admin'], true);
    }

    private function role(User $user, Workspace $workspace): ?string
    {
        return WorkspaceUser::query()
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $user->id)
            ->value('role');
    }
}

