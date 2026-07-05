/*
  Clean up older app metadata rows that stored JSON strings with doubled quotes
  such as [""duenio""] instead of ["duenio"].
*/

IF OBJECT_ID('dbo.app_legacy_user_metadata', 'U') IS NOT NULL
BEGIN
    UPDATE dbo.app_legacy_user_metadata
    SET roles_json = REPLACE(roles_json, '""', '"')
    WHERE roles_json IS NOT NULL
      AND ISJSON(roles_json) = 0
      AND ISJSON(REPLACE(roles_json, '""', '"')) = 1;
END;
GO
