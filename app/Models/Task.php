<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Task extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'workspace_id',
        'board_id',
        'column_id',
        'title',
        'description',
        'priority',
        'checklist',
        'assignee_id',
        'due_at',
        'is_completed',
        'position',
    ];

    protected $casts = [
        'due_at' => 'datetime',
        'is_completed' => 'boolean',
        'checklist' => 'array',
    ];

    public function column(): BelongsTo
    {
        return $this->belongsTo(Column::class, 'column_id');
    }

    public function board(): BelongsTo
    {
        return $this->belongsTo(Board::class, 'board_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }
}

