<?php

use Illuminate\Support\Facades\Route;

// React SPA (без префикса /app). Важно: не перехватывать /api/*.
Route::view('/{any?}', 'app')
    ->where('any', '^(?!api).*$');
