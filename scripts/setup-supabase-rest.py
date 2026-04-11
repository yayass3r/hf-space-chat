#!/usr/bin/env python3
"""Setup Supabase using REST API with service role key to create tables and settings."""

import urllib.request
import json
import ssl

SUPABASE_URL = "https://uuslujxtsrtbvjihcdzw.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1c2x1anh0c3J0YnZqaWhjZHp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDQ1MDI0NSwiZXhwIjoyMDU5ODI5MjQ1fQ.rTjXQxa1BLbJ0uOQaYYEwJpIJW1-MhFQ9iI4K5qMWSk"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def api_request(method, path, data=None):
    url = f"{SUPABASE_URL}{path}"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=15, context=ctx)
        status = resp.status
        try:
            result = json.loads(resp.read().decode())
        except:
            result = None
        return status, result
    except urllib.error.HTTPError as e:
        body_text = e.read().decode() if e.fp else ""
        return e.code, body_text
    except Exception as e:
        return 0, str(e)

def main():
    print("=" * 50)
    print("Supabase REST API Setup")
    print("=" * 50)

    # Step 1: Check existing tables
    print("\n--- Checking Existing Tables ---")
    for table in ["profiles", "site_settings", "projects", "ai_chat_messages"]:
        status, result = api_request("GET", f"/rest/v1/{table}?select=*&limit=1")
        if status == 200:
            print(f"  {table}: EXISTS (status={status})")
        elif status == 404:
            print(f"  {table}: NOT FOUND - needs creation")
        else:
            print(f"  {table}: status={status}, result={str(result)[:100]}")

    # Step 2: Try creating tables via RPC if possible
    # First, try to create an RPC function that can execute DDL
    # Since we can't create functions via REST, let's try a different approach
    
    # Check if we can insert into site_settings
    print("\n--- Inserting Default Settings ---")
    settings = [
        ("admin_emails", "admin@example.com"),
        ("adsense_enabled", "false"),
        ("adsense_client_id", ""),
        ("adsense_ad_slot", ""),
        ("admob_enabled", "false"),
        ("admob_app_id", ""),
        ("admob_ad_unit_id", ""),
        ("site_name", "HF Space Chat"),
        ("hf_space_url", "https://your-space.hf.space"),
        ("hf_api_path", "/api/predict"),
    ]
    
    for key, value in settings:
        # Try upsert
        status, result = api_request("POST", "/rest/v1/site_settings", {"key": key, "value": value})
        if status == 201:
            print(f"  Inserted: {key}")
        elif status == 409:
            # Conflict - try update
            status2, result2 = api_request("PATCH", f"/rest/v1/site_settings?key=eq.{key}", {"value": value})
            if status2 == 200:
                print(f"  Updated: {key}")
            else:
                print(f"  Update failed for {key}: {status2}")
        else:
            print(f"  {key}: status={status}, {str(result)[:100]}")

    # Step 3: Verify settings
    print("\n--- Verifying Settings ---")
    status, result = api_request("GET", "/rest/v1/site_settings?select=*&order=key")
    if status == 200 and result:
        print(f"  Found {len(result)} settings:")
        for s in result:
            print(f"    {s['key']}: {s['value'][:40]}")
    else:
        print(f"  Could not verify: status={status}")

    # Step 4: Try to check profiles table
    print("\n--- Checking Profiles Table ---")
    status, result = api_request("GET", "/rest/v1/profiles?select=*&limit=5")
    if status == 200:
        print(f"  Profiles table EXISTS, found {len(result)} profiles")
    elif status == 404:
        print("  Profiles table DOES NOT EXIST")
        print("  Need to create it via SQL Editor")
    else:
        print(f"  Status: {status}, {str(result)[:200]}")

    # Summary
    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    
    profiles_exists = False
    settings_exists = False
    
    status, _ = api_request("GET", "/rest/v1/profiles?select=id&limit=1")
    profiles_exists = status == 200
    
    status, _ = api_request("GET", "/rest/v1/site_settings?select=key&limit=1")
    settings_exists = status == 200
    
    if profiles_exists and settings_exists:
        print("All tables exist! Setup may have been done before.")
        print("Try inserting settings...")
    else:
        missing = []
        if not profiles_exists:
            missing.append("profiles")
        if not settings_exists:
            missing.append("site_settings")
        print(f"Missing tables: {missing}")
        print("\nACTION REQUIRED:")
        print("1. Go to: https://supabase.com/dashboard/project/uuslujxtsrtbvjihcdzw/sql")
        print("2. Copy the SQL from: supabase/setup.sql")
        print("3. Paste and click Run")

if __name__ == "__main__":
    main()
