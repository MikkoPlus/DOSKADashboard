<?php

namespace App\Jobs;

use App\Models\ActivityLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class LogActivity implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public string $workspaceId,
        public ?string $userId,
        public string $action,
        public array $metadata = [],
    ) {
    }

    public function handle(): void
    {
        ActivityLog::query()->create([
            'workspace_id' => $this->workspaceId,
            'user_id' => $this->userId,
            'action' => $this->action,
            'metadata' => $this->metadata,
            'created_at' => now(),
        ]);
    }
}

