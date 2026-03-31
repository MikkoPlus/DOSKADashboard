<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\Auth\RegisterController;
use App\Http\Controllers\Api\V1\Auth\LoginController;
use App\Http\Controllers\Api\V1\Auth\LogoutController;
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
    });
});

