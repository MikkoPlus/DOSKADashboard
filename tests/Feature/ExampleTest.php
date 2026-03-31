<?php

namespace Tests\Feature;

use App\Jobs\LogActivity;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_get_personal_workspace(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Api User',
            'email' => 'api_user@example.com',
            'password' => 'password',
        ]);

        $response
            ->assertCreated()
            ->assertJsonStructure([
                'user' => ['id', 'name', 'email'],
                'token',
                'workspace' => ['id', 'name', 'type'],
            ]);

        $userId = $response->json('user.id');
        $workspaceId = $response->json('workspace.id');

        $this->assertNotNull($userId);
        $this->assertNotNull($workspaceId);

        $workspace = Workspace::query()->find($workspaceId);

        $this->assertNotNull($workspace);
        $this->assertSame('personal', $workspace->type);

        $pivot = WorkspaceUser::query()
            ->where('workspace_id', $workspaceId)
            ->where('user_id', $userId)
            ->first();

        $this->assertNotNull($pivot);
        $this->assertSame('owner', $pivot->role);
    }

    public function test_authenticated_user_can_list_own_workspaces(): void
    {
        /** @var User $user */
        $user = User::factory()->create();
        $workspace = Workspace::createPersonalForUser($user);

        $token = $user->createToken('test')->plainTextToken;

        $response = $this
            ->withToken($token)
            ->getJson('/api/v1/workspaces');

        $response
            ->assertOk()
            ->assertJsonFragment(['id' => $workspace->id]);
    }

    public function test_user_cannot_access_foreign_workspace(): void
    {
        /** @var User $owner */
        $owner = User::factory()->create();
        $workspace = Workspace::createPersonalForUser($owner);

        /** @var User $other */
        $other = User::factory()->create();
        $token = $other->createToken('test')->plainTextToken;

        $response = $this
            ->withToken($token)
            ->getJson("/api/v1/workspaces/{$workspace->id}");

        $response->assertForbidden();
    }

    public function test_user_can_create_board_column_and_task_via_api(): void
    {
        /** @var User $user */
        $user = User::factory()->create();
        $workspace = Workspace::createPersonalForUser($user);
        $token = $user->createToken('test')->plainTextToken;

        // Board
        $boardResponse = $this
            ->withToken($token)
            ->postJson('/api/v1/boards', [
                'workspace_id' => $workspace->id,
                'name' => 'API Board',
            ]);

        $boardResponse->assertCreated();
        $boardId = $boardResponse->json('id');

        $board = Board::query()->find($boardId);
        $this->assertNotNull($board);

        // Column
        $columnResponse = $this
            ->withToken($token)
            ->postJson('/api/v1/columns', [
                'board_id' => $boardId,
                'name' => 'API Column',
            ]);

        $columnResponse->assertCreated();
        $columnId = $columnResponse->json('id');

        $column = Column::query()->find($columnId);
        $this->assertNotNull($column);

        // Task
        $taskResponse = $this
            ->withToken($token)
            ->postJson('/api/v1/tasks', [
                'board_id' => $boardId,
                'column_id' => $columnId,
                'title' => 'API Task',
            ]);

        $taskResponse->assertCreated();
        $taskId = $taskResponse->json('id');

        $task = Task::query()->find($taskId);
        $this->assertNotNull($task);
        $this->assertSame('API Task', $task->title);
    }

    public function test_task_creation_dispatches_activity_log_job(): void
    {
        Queue::fake();

        /** @var User $user */
        $user = User::factory()->create();
        $workspace = Workspace::createPersonalForUser($user);
        $token = $user->createToken('test')->plainTextToken;

        $board = Board::query()->create([
            'workspace_id' => $workspace->id,
            'name' => 'Board For Logging',
            'position' => 1,
            'is_archived' => false,
        ]);

        $column = Column::query()->create([
            'workspace_id' => $workspace->id,
            'board_id' => $board->id,
            'name' => 'Todo',
            'position' => 1,
        ]);

        $response = $this
            ->withToken($token)
            ->postJson('/api/v1/tasks', [
                'board_id' => $board->id,
                'column_id' => $column->id,
                'title' => 'Task with logging',
            ]);

        $response->assertCreated();

        Queue::assertPushed(LogActivity::class, function (LogActivity $job) use ($workspace, $user) {
            return $job->workspaceId === $workspace->id
                && $job->userId === $user->id
                && $job->action === 'task.created';
        });
    }

    public function test_task_update_dispatches_activity_log_job(): void
    {
        Queue::fake();

        /** @var User $user */
        $user = User::factory()->create();
        $workspace = Workspace::createPersonalForUser($user);
        $token = $user->createToken('test')->plainTextToken;

        $board = Board::query()->create([
            'workspace_id' => $workspace->id,
            'name' => 'Board For Update Log',
            'position' => 1,
            'is_archived' => false,
        ]);

        $column = Column::query()->create([
            'workspace_id' => $workspace->id,
            'board_id' => $board->id,
            'name' => 'Todo',
            'position' => 1,
        ]);

        $task = Task::query()->create([
            'workspace_id' => $workspace->id,
            'board_id' => $board->id,
            'column_id' => $column->id,
            'title' => 'Task Before Update',
            'description' => null,
            'assignee_id' => $user->id,
            'due_at' => null,
            'is_completed' => false,
            'position' => 1,
        ]);

        $response = $this
            ->withToken($token)
            ->patchJson("/api/v1/tasks/{$task->id}", [
                'title' => 'Task After Update',
            ]);

        $response->assertOk();

        Queue::assertPushed(LogActivity::class, function (LogActivity $job) use ($workspace, $user, $task) {
            return $job->workspaceId === $workspace->id
                && $job->userId === $user->id
                && $job->action === 'task.updated'
                && ($job->metadata['task_id'] ?? null) === $task->id;
        });
    }

    public function test_board_archive_dispatches_activity_log_job(): void
    {
        Queue::fake();

        /** @var User $user */
        $user = User::factory()->create();
        $workspace = Workspace::createPersonalForUser($user);
        $token = $user->createToken('test')->plainTextToken;

        $board = Board::query()->create([
            'workspace_id' => $workspace->id,
            'name' => 'Board For Archive Log',
            'position' => 1,
            'is_archived' => false,
        ]);

        $response = $this
            ->withToken($token)
            ->deleteJson("/api/v1/boards/{$board->id}");

        $response->assertOk();

        Queue::assertPushed(LogActivity::class, function (LogActivity $job) use ($workspace, $user, $board) {
            return $job->workspaceId === $workspace->id
                && $job->userId === $user->id
                && $job->action === 'board.archived'
                && ($job->metadata['board_id'] ?? null) === $board->id;
        });
    }
}
