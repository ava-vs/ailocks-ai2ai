# Single-Call File Upload API

This document describes the single-call file upload API endpoint that allows uploading files to Netlify Blobs in a single request.

## Endpoint

```
POST https://ailock-network.netlify.app/.netlify/functions/products-upload-single
```

## Request Format

The request must be sent as `multipart/form-data` with the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Seller email for authentication |
| password | string | Yes | Seller password for authentication |
| title | string | Yes | Title of the product |
| file | file | Yes | The file to upload |
| contentType | string | No | MIME type (if not provided, will be inferred from file) |
| chunkSize | number | No | Size of chunks in bytes (default: 4MB) |

## Response Format

### Success Response

```json
{
  "success": true,
  "productId": "product_id_string",
  "title": "Product Title",
  "contentType": "application/pdf",
  "size": 1234567,
  "contentHash": "sha256_hash_of_file",
  "message": "File uploaded successfully"
}
```

### Error Response

```json
{
  "error": "Error message",
  "details": "Additional error details (if available)"
}
```

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Missing required fields: email, password, title |
| 401 | Unauthorized - Invalid credentials |
| 405 | Method Not Allowed - Only POST method is supported |
| 500 | Internal Server Error |

## File Size Limits

- Maximum file size: 200MB
- Maximum chunk size: 4.5MB (default: 4MB)

## Example Usage

### Using cURL

```bash
curl -X POST "https://ailock-network.netlify.app/.netlify/functions/products-upload-single" \
  -F "email=seller@example.com" \
  -F "password=password123" \
  -F "title=My Product" \
  -F "file=@/path/to/file.pdf"
```

### Using Postman

1. Create a new POST request to `https://ailock-network.netlify.app/.netlify/functions/products-upload-single`
2. Select "Body" tab and choose "form-data"
3. Add the following key-value pairs:
   - email: seller@example.com
   - password: password123
   - title: My Product
   - file: [select file]
4. Click "Send"

## Implementation Notes

This endpoint combines several operations into a single API call:

1. **Authentication** - Validates user credentials and generates a JWT token internally
2. **Owner Identification** - Automatically determines the Ailock ID of the user from the database
3. **Product Creation** - Creates a product record in the database
4. **Upload Initialization** - Initializes the chunked upload process
5. **Chunked Upload** - Breaks the file into chunks and uploads each chunk
6. **Upload Completion** - Completes the upload by sending a manifest

### Special File Type Handling

- **Markdown files (.md)**: Automatically sets the MIME type to `text/markdown`
- For other file types, the MIME type is determined automatically or can be specified explicitly

This simplifies the upload process for clients that cannot easily manage multi-step uploads with state management.

### Internal Implementation Notes

- Upload session metadata persists `uploadedChunks` как массив для JSON-совместимости и восстанавливается как `Set` во время выполнения. Это предотвращает проблемы сериализации в serverless хранилище.
- При завершении загрузки запись продукта обновляет `storagePointer` на итоговый префикс blob и обновляет `updatedAt`. Манифест чанков сохраняется в поле `manifest`.
- **Важное примечание по схеме БД**: В схеме кода (`schema.ts`) определено поле `storageRef`, но в базе данных это поле отсутствует. Для обеспечения совместимости, поле `storageRef` исключается из запроса вставки. Для долгосрочного решения требуется либо добавить колонку в БД через миграцию, либо удалить поле из схемы кода.
