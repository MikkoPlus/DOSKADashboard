# DOSKA Dashboard API

Backend для kanban-системы (в стиле Trello) в формате multi-tenant SaaS: рабочие пространства, доски, колонки, задачи, RBAC, Activity Log и очереди.

## Стек

- Laravel 12
- PostgreSQL
- Redis (очереди)
- Laravel Sanctum
- Docker / Laravel Sail

## Основные возможности

- Multi-tenant изоляция данных по `workspace_id`
- Роли в workspace: `owner`, `admin`, `member`
- RBAC через Policies + middleware
- CRUD API для досок/колонок/задач
- Перемещение и переупорядочивание (drag & drop) через транзакции и блокировки строк
- Activity Log в PostgreSQL `JSONB` + GIN индекс

## Быстрый старт

1. Установить зависимости:

```bash
composer install
```

2. Создать `.env` и сгенерировать ключ приложения:

```bash
cp .env.example .env
php artisan key:generate
```

3. Убедиться, что в `.env` указаны настройки PostgreSQL (Sail defaults):

```env
DB_CONNECTION=pgsql
DB_HOST=pgsql
DB_PORT=5432
DB_DATABASE=laravel
DB_USERNAME=sail
DB_PASSWORD=password
```

4. Поднять контейнеры:

```bash
./vendor/bin/sail up -d
```

5. Применить миграции и сгенерировать демо-данные:

```bash
./vendor/bin/sail artisan migrate:fresh --seed
```

6. Запустить тесты:

```bash
./vendor/bin/sail artisan test
```

## API

Базовый префикс: `/api/v1`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout` (требуется Sanctum токен)

### Workspaces

- `GET /workspaces`
- `POST /workspaces`
- `GET /workspaces/{workspace}`

### Boards

- `GET /workspaces/{workspace}/boards`
- `GET /boards/{id}`
- `POST /boards`
- `DELETE /boards/{id}` (архивирование доски)

### Columns

- `POST /columns`
- `PATCH /columns/{id}`
- `DELETE /columns/{id}`

### Tasks

- `POST /tasks`
- `PATCH /tasks/{id}`
- `DELETE /tasks/{id}`

## RBAC (роли и доступы)

- `owner`: полный доступ к workspace, управление участниками, удаление/архивирование досок
- `admin`: управление участниками, удаление/архивирование досок
- `member`: операции с досками/колонками/задачами, без удаления/архивирования досок

Доступ проверяется через:

- Policies (`WorkspacePolicy`, `BoardPolicy`, `TaskPolicy`)
- Middleware алиас `current.workspace`

## Activity Log

Действия логируются асинхронно через job `LogActivity` в таблицу `activity_logs`:

- `workspace_id`, `user_id`, `action`, `metadata` (`JSONB`), `created_at`

Индексы:

- `(workspace_id, action)`
- `GIN (metadata)`

## Очереди

Запуск воркера (пример):

```bash
./vendor/bin/sail artisan queue:work
```

## Демо-данные

Seeder создаёт:

- 1 demo user (`demo@example.com`)
- 1 personal workspace
- 1 доску
- 4 колонки
- 10 задач

## Примечания

- API использует Sanctum токены: `Authorization: Bearer <token>`.
- Проект ориентирован на PostgreSQL-фичи (`JSONB`, partial indexes, GIN).
