<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\Auth\RegisterController;
use App\Http\Controllers\Api\V1\Auth\LoginController;
use App\Http\Controllers\Api\V1\Auth\LogoutController;
use App\Http\Controllers\Api\V1\Board\BoardController;
use App\Http\Controllers\Api\V1\Column\ColumnController;
use App\Http\Controllers\Api\V1\Task\TaskController;
use App\Http\Controllers\Api\V1\Workspace\WorkspaceController;

Route::prefix('v1')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('register', RegisterController::class)->name('api.v1.auth.register');
        Route::post('login', LoginController::class)->name('api.v1.auth.login');
        Route::post('logout', LogoutController::class)->middleware('auth:sanctum')->name('api.v1.auth.logout');
    });

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('workspaces', [WorkspaceController::class, 'index'])->name('api.v1.workspaces.index');
        Route::post('workspaces', [WorkspaceController::class, 'store'])->name('api.v1.workspaces.store');
        Route::get('workspaces/{workspace}', [WorkspaceController::class, 'show'])->name('api.v1.workspaces.show');

        Route::middleware('current.workspace')->group(function () {
            // Boards
            Route::get('workspaces/{workspace}/boards', [BoardController::class, 'indexByWorkspace']);
            Route::get('boards/{id}', [BoardController::class, 'show']);
            Route::post('boards', [BoardController::class, 'store']);
            Route::delete('boards/{id}', [BoardController::class, 'destroy']);

            // Columns
            Route::get('boards/{board}/columns', [ColumnController::class, 'indexByBoard']);
            Route::patch('boards/{board}/columns/reorder', [ColumnController::class, 'reorderByBoard']);
            Route::post('columns', [ColumnController::class, 'store']);
            Route::patch('columns/{id}', [ColumnController::class, 'update']);
            Route::delete('columns/{id}', [ColumnController::class, 'destroy']);

            // Tasks
            Route::get('boards/{board}/tasks', [TaskController::class, 'indexByBoard']);
            Route::post('tasks', [TaskController::class, 'store']);
            Route::patch('tasks/{id}', [TaskController::class, 'update']);
            Route::delete('tasks/{id}', [TaskController::class, 'destroy']);
        });
    });
});

