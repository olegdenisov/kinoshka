# Кэширование pnpm store в GitHub Actions

## Зачем это нужно

`pnpm install --frozen-lockfile` каждый раз скачивает пакеты из npm registry. Для проекта с несколькими сотнями транзитивных зависимостей это 30–90 секунд. С параллельными jobs в CI — это N × 30–90 сек скачиваний.

Кэш устраняет скачивание: пакеты восстанавливаются из кэша раннера, `pnpm install` только создаёт симлинки (2–5 сек).

## Как pnpm хранит пакеты

В отличие от npm/yarn, pnpm не кладёт пакеты напрямую в `node_modules`. Он использует **глобальный content-addressable store** (на Linux: `~/.local/share/pnpm/store`). Каждый пакет хранится один раз по хэшу содержимого. `node_modules` содержит только хардлинки в этот стор.

Поэтому кэшировать нужно **store**, а не `node_modules`.

## Подход 1 — `cache: pnpm` в `actions/setup-node` (используется в проекте)

```yaml
- uses: pnpm/action-setup@v4 # должен быть РАНЬШЕ setup-node
  with:
    version: "10"

- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: pnpm # включает кэш pnpm store
```

`cache: pnpm` заставляет `setup-node` сделать три вещи:

1. Запустить `pnpm store path` → получить путь к стору
2. Восстановить кэш по ключу, основанному на хэше `pnpm-lock.yaml`
3. После job'а сохранить стор в кэш (если ключ новый)

**Ключ кэша** выглядит примерно так:

```
Linux-node-22.x-<hash of pnpm-lock.yaml>
```

- `pnpm-lock.yaml` не изменился → **cache hit** → стор восстановлен, `pnpm install` работает мгновенно
- `pnpm-lock.yaml` изменился → **cache miss** → полное скачивание, новый кэш сохранён

## Подход 2 — явный `actions/cache` с `restore-keys`

Нужен, если хочется `restore-keys` — резервный ключ на случай промаха:

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: "10"

- uses: actions/setup-node@v4
  with:
    node-version: 22
    # без cache: pnpm — управляем кэшем сами

- name: Get pnpm store path
  run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

- uses: actions/cache@v4
  with:
    path: ${{ env.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-
```

`restore-keys` работает так: если точного ключа нет (изменился `pnpm-lock.yaml`), GitHub ищет кэш с префиксом `Linux-pnpm-` и восстанавливает самый свежий. `pnpm install` тогда докачивает только новые пакеты, а не всё с нуля.

## Что выбрать

`cache: pnpm` — это `actions/cache` под капотом, просто без шаблонного кода. Подходит для большинства проектов.

`actions/cache` вручную нужен только если:

- хочется `restore-keys` при частых изменениях зависимостей
- нестандартный путь к стору
- нужен полный контроль над ключом кэша

Для параллельных jobs (`lint`, `typecheck`, `test`, `build`) все четыре job'а восстанавливают кэш по одному ключу — GitHub Actions поддерживает одновременное чтение, запись происходит только один раз (первый завершившийся job).
