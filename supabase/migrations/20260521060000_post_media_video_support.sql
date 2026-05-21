-- Add video MIME types to post-media bucket and increase file size limit to 100MB

UPDATE storage.buckets
SET
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
    'video/mp4', 'video/webm', 'video/quicktime'
  ],
  file_size_limit = 104857600  -- 100MB
WHERE id = 'post-media';
