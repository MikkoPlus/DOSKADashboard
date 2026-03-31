<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Board extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'workspace_id',
        'name',
        'position',
        'is_archived',
    ];

    protected $casts = [
        'is_archived' => 'boolean',
    ];

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class, 'workspace_id');
    }

    public function columns(): HasMany
    {
        return $this->hasMany(Column::class, 'board_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'board_id');
    }
}

