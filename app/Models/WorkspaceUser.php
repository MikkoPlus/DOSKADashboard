<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkspaceUser extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'workspace_user';

    protected $fillable = [
        'workspace_id',
        'user_id',
        'role',
    ];
}

