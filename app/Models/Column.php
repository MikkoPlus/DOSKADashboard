<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Column extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'workspace_id',
        'board_id',
        'name',
        'position',
    ];

    public function board(): BelongsTo
    {
        return $this->belongsTo(Board::class, 'board_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'column_id');
    }
}

