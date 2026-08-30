# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Chat MCP

[English](./README.md) | **Русский**

[![npm](https://img.shields.io/npm/v/mcp-google-chat)](https://www.npmjs.com/package/mcp-google-chat)
[![CI](https://github.com/A1-x-Tech/mcp-google-chat/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-chat/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-chat/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-chat)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Chat MCP** позволяет AI-приложению работать в Google Chat на естественном языке. Можно найти нужное пространство или личный чат, вникнуть в переписку, ответить в треде, поставить эмодзи-реакцию и управлять составом участников.

Сервер работает с Google Chat API через ваш Google-аккаунт и действует от имени вошедшего пользователя: сообщения отправляются под вашим именем, а редактировать и удалять можно только собственные сообщения и реакции. Ограничения Chat API он показывает явно, а не создаёт впечатление, что в чате можно сделать всё.

- **14 инструментов.** Поиск пространств и личных чатов, чтение и отправка сообщений с управлением тредами, эмодзи-реакции, метаданные вложений и управление участниками.
- **Вы действуете от своего имени.** Отправленное появляется под вашим именем; редактирование и удаление не выходят за пределы ваших собственных сообщений и реакций.
- **Отправка никогда не повторяется.** После неоднозначного сбоя сервер не повторяет запись — повторённая отправка стала бы дублем сообщения в реальном чате.
- **Минимальные scope Google.** Сервер отправляет тот токен, который вы выпустили; запрашивайте scope под задачу — для просмотра пространств и сообщений хватает read-only.

Начните с запроса, который только читает данные:

> Покажи сегодняшние сообщения в пространстве команды и кратко перескажи, о чём договорились.

[Подключить сервер](#быстрый-старт) · [Посмотреть сценарии](#что-можно-поручить) · [Открыть техническую документацию](#техническая-документация)

---

## Увидеть работу за минуту

> **Вы:** Что сегодня обсуждали в пространстве релиза?
>
> **Ассистент:** Показывает сегодняшние сообщения с отправителями и тредами. Ничего не меняется.
>
> **Вы:** Ответь в треде про деплой, что выкатка завершена.
>
> **Ассистент:** Показывает целевое пространство, тред и черновик текста, затем запрашивает подтверждение перед отправкой.
>
> **Вы:** Подтверждаю.
>
> **Ассистент:** Отправляет ответ под вашим именем в этот тред. Другие сообщения он не трогает.

## Содержание

- [Быстрый старт](#быстрый-старт)
- [Что можно поручить](#что-можно-поручить)
- [Как сервер действует в чате](#как-сервер-действует-в-чате)
- [Что может измениться](#что-может-измениться)
- [Как получить доступ](#как-получить-доступ)
- [Конфигурация](#конфигурация)
- [Данные, лимиты и работа в фоне](#данные-лимиты-и-работа-в-фоне)
- [Техническая документация](#техническая-документация)
- [Поддержка](#поддержка)

## Быстрый старт

Нужны Node.js 20+, Google-аккаунт с доступом к Google Chat и OAuth-данные из проекта Google Cloud с включённым Google Chat API.

1. [Подготовьте Google OAuth-доступ](#как-получить-доступ).
2. Добавьте сервер в AI-приложение.
3. Отправьте запрос, который только читает данные.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**В приложении:** откройте **Settings → Plugins → MCP servers**, нажмите **Add server**, затем добавьте `npx -y mcp-google-chat@latest` с `GOOGLE_CHAT_CLIENT_ID`, `GOOGLE_CHAT_CLIENT_SECRET` и `GOOGLE_CHAT_REFRESH_TOKEN`.

**В командной строке:**

```bash
codex mcp add google-chat \
  --env GOOGLE_CHAT_CLIENT_ID=your_client_id \
  --env GOOGLE_CHAT_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_CHAT_REFRESH_TOKEN=your_refresh_token \
  -- npx -y mcp-google-chat@latest
```

```bash
codex mcp list
```

[Документация Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

</details>

<details>
<summary><strong>Claude Code</strong></summary>

<br>

```bash
claude mcp add \
  --env GOOGLE_CHAT_CLIENT_ID=your_client_id \
  --env GOOGLE_CHAT_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_CHAT_REFRESH_TOKEN=your_refresh_token \
  --transport stdio --scope user google-chat \
  -- npx -y mcp-google-chat@latest
```

```bash
claude mcp list
```

[Документация Claude Code MCP](https://code.claude.com/docs/en/mcp)

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

<br>

Откройте **Settings → Developer → Edit Config** и добавьте:

```json
{
  "mcpServers": {
    "google-chat": {
      "command": "npx",
      "args": ["-y", "mcp-google-chat@latest"],
      "env": {
        "GOOGLE_CHAT_CLIENT_ID": "your_client_id",
        "GOOGLE_CHAT_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_CHAT_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

Если **Edit Config** недоступна, отредактируйте `~/Library/Application Support/Claude/claude_desktop_config.json` на macOS или `%APPDATA%\Claude\claude_desktop_config.json` на Windows.

[Документация Claude Desktop MCP](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)

</details>

<details>
<summary><strong>Cursor</strong></summary>

<br>

Добавьте в `~/.cursor/mcp.json` на macOS/Linux или `%USERPROFILE%\.cursor\mcp.json` на Windows:

```json
{
  "mcpServers": {
    "google-chat": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-chat@latest"],
      "env": {
        "GOOGLE_CHAT_CLIENT_ID": "your_client_id",
        "GOOGLE_CHAT_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_CHAT_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

[Документация Cursor MCP](https://cursor.com/docs/mcp)

</details>

<details>
<summary><strong>VS Code</strong></summary>

<br>

Запустите **MCP: Open User Configuration** и добавьте:

```json
{
  "servers": {
    "google-chat": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-chat@latest"],
      "env": {
        "GOOGLE_CHAT_CLIENT_ID": "${input:chat_client_id}",
        "GOOGLE_CHAT_CLIENT_SECRET": "${input:chat_client_secret}",
        "GOOGLE_CHAT_REFRESH_TOKEN": "${input:chat_refresh_token}"
      }
    }
  },
  "inputs": [
    { "type": "promptString", "id": "chat_client_id", "description": "Google OAuth client ID" },
    { "type": "promptString", "id": "chat_client_secret", "description": "Google OAuth client secret", "password": true },
    { "type": "promptString", "id": "chat_refresh_token", "description": "Google OAuth refresh token", "password": true }
  ]
}
```

Проверьте сервер командой **MCP: List Servers**.

[Документация VS Code MCP](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

</details>

## Что можно поручить

### Вникнуть в переписку

- Покажи мои пространства и найди личный чат с alex@example.com.
- Что сегодня писали в пространстве релиза? Суммируй принятые решения.
- Покажи весь тред, к которому относится это сообщение.

### Отправлять и править сообщения

- Отправь статус-апдейт в пространство команды.
- Ответь в треде про деплой, что выкатка завершена.
- Исправь опечатку в моём последнем сообщении или удали его совсем.

### Реагировать и проверять вложения

- Поставь 👍 на анонс и покажи, кто ещё чем отреагировал.
- Убери мою реакцию с того сообщения.
- Какие файлы приложены к этому сообщению? Покажи имена и типы.

### Управлять участниками пространства

- Кто состоит в этом пространстве и кто его менеджеры?
- Добавь alex@example.com в пространство и сделай его менеджером.
- Удали бывшего коллегу из пространства.

## Как сервер действует в чате

1. С OAuth-данными refresh-потока сервер действует **от имени вошедшего пользователя**: сообщения отправляются под вашим именем, а редактирование и удаление достают только до ваших собственных сообщений и реакций. Для изменения состава участников дополнительно нужно быть менеджером пространства.
2. Пространство можно указать голым id, но сообщения, треды, участники, реакции и вложения адресуются **полными именами ресурсов**, которые возвращает API, — сначала получите список, затем действуйте по точному имени.
3. Ответ попадает в тред по его имени или по ключу треда. По умолчанию отправка откатывается к созданию нового треда, когда ответить в целевой нельзя; можно попросить вместо этого завершиться ошибкой.
4. Работа в роли **Chat-приложения** — карточки, личные сообщения от приложения, отдельный эндпоинт вложений, принудительное удаление — это отдельная конфигурация Google Cloud; единственный мост сюда — access token сервисного аккаунта, переданный через `GOOGLE_CHAT_ACCESS_TOKEN`.

Chat API не умеет искать по тексту сообщений — единственные фильтры сообщений — это время создания и тред. `find_direct_message` находит существующий личный чат, но никогда не создаёт его, а байты файлов через этот сервер не скачиваются и не загружаются. Создание пространств и остальные непокрытые методы API идут через `raw_request`.

## Что может измениться

| Операция | Что происходит | Граница подтверждения |
|---|---|---|
| Чтение пространств, сообщений, участников, реакций и метаданных вложений | Читает переписку и метаданные | Ничего не меняет |
| Отправка сообщения | Публикует в реальном пространстве под вашим именем | Меняет переписку |
| Обновление сообщения | Заменяет текст вашего собственного сообщения | Меняет переписку |
| Добавление или снятие реакции | Меняет вашу собственную реакцию на сообщении | Меняет переписку |
| Удаление сообщения | Безвозвратно удаляет сообщение | Разрушительно |
| Управление участниками | Добавляет, меняет роль или удаляет участника пространства | Потенциально разрушительно |
| Технический запрос API | Может вызвать метод API без отдельного инструмента | Потенциально разрушительно |

Как AI-приложение просит подтверждение, определяет само приложение. Сервер помечает операции чтения, записи и удаления, чтобы оно отличило просмотр переписки от публикации.

## Как получить доступ

Google Chat требует OAuth 2.0: одного API-ключа недостаточно.

1. Создайте или выберите проект Google Cloud и включите **Google Chat API**.
2. Настройте OAuth consent screen и создайте OAuth-клиент типа **Desktop app**.
3. Авторизуйте Google-аккаунт, от имени которого будете писать. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) поможет получить refresh token, если включить **Use your own OAuth credentials**.
4. Запрашивайте только те scope, которые нужны вашим сессиям. Для чтения и отправки достаточно этих:

   ```text
   https://www.googleapis.com/auth/chat.spaces.readonly
   https://www.googleapis.com/auth/chat.messages.readonly
   https://www.googleapis.com/auth/chat.messages.create
   ```

   Полная таблица по задачам — редактирование и удаление своих сообщений, реакции, участники, админский поиск — в [docs/TOOLS.md](./docs/TOOLS.md#minimal-oauth-scopes).

Refresh token OAuth-приложения в режиме Testing может истечь через семь дней. Для долгого доступа опубликуйте OAuth-приложение или используйте Internal-приложение в домене Workspace. Храните client secret и refresh token как пароли.

Для короткой сессии подойдёт и короткоживущий токен в `GOOGLE_CHAT_ACCESS_TOKEN` — например из `gcloud auth print-access-token` с выданными Chat-scope. Через эту же переменную на сервер попадает токен сервисного аккаунта Chat-приложения, когда нужны функции, доступные только приложению.

## Конфигурация

| Переменная | Обязательна | Описание |
|---|---|---|
| `GOOGLE_CHAT_CLIENT_ID` | Да* | OAuth client ID. |
| `GOOGLE_CHAT_CLIENT_SECRET` | Да* | OAuth client secret. |
| `GOOGLE_CHAT_REFRESH_TOKEN` | Да* | OAuth refresh token. |
| `GOOGLE_CHAT_ACCESS_TOKEN` | Да* | Короткоживущая альтернатива OAuth-тройке; может быть токеном сервисного аккаунта или Chat-приложения. |
| `GOOGLE_CHAT_API_BASE` | Нет | Переопределяет базовый URL Google Chat API. |
| `GOOGLE_CHAT_TIMEOUT_MS` | Нет | Тайм-аут одного запроса; по умолчанию `60000` мс. |
| `GOOGLE_CHAT_MAX_RETRIES` | Нет | Повторы временных ошибок; по умолчанию `3`. |

\* Передайте OAuth-тройку или access token.

Запущенный без учётных данных сервер всё равно завершает MCP-рукопожатие; первый вызов инструмента называет точные переменные, которые нужно задать, и просит перезапуск — вместо молчаливого отказа.

## Данные, лимиты и работа в фоне

- **Запросы идут в Google Chat.** Локальный сервер обновляет OAuth-токены Google и вызывает Chat API; токен никогда не отправляется на другой хост. Анонимная телеметрия содержит ID установки, версию пакета, версии AI-клиента и платформы и имена инструментов — но не OAuth-токены, текст сообщений, аргументы или промпты. Чтобы отключить её, задайте `ASKADS_TELEMETRY=0`.
- **У Google есть квоты на проект и пользователя.** При `429` сервер использует задержку; чтение также повторяется после сетевых и `5xx` ошибок, а запись после неопределённой ошибки не повторяется никогда — повторённая отправка стала бы дублем сообщения в реальном чате. `send_message` принимает собственный id сообщения, который делает отправку адресуемой и защищённой от дублей.
- **Постоянного опроса нет.** Сервер работает только при вызове. `list_messages` может инкрементально опрашивать пространство по времени создания, если AI-приложение поддерживает задания по расписанию; подписки на события пространства идут через `raw_request`.

## Техническая документация

- [Каталог MCP-возможностей](./docs/capabilities/index.md) — страницы по пользовательским задачам для каждого инструмента.
- [Все инструменты и параметры](./docs/TOOLS.md)
- [Документация по разработке](./docs/DEVELOPMENT.md)
- [Документация по публикации](./docs/PUBLISHING.md)
- [Справочник Google Chat API](https://developers.google.com/workspace/chat)

## Поддержка

Нашли ошибку или не хватает сценария? [Создайте issue](https://github.com/A1-x-Tech/mcp-google-chat/issues) или напишите в [Telegram](https://t.me/a1_mcp).

<br>

<p align="center">
  <img src="https://github.com/ztemerbekov/a1-yandex-kit-skills/raw/main/assets/images/mona-hifive-yandex-kit-warm.gif" alt="Две Моны дают пять" width="256">
</p>

<p align="center">
  Вы дочитали до конца!
</p>
