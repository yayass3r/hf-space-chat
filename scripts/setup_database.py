import psycopg2
import os
import sys

DB_HOST = os.environ.get('DB_HOST', 'db.ucmpclgctjeyoimtmqir.supabase.co')
DB_PORT = int(os.environ.get('DB_PORT', '5432'))
DB_NAME = os.environ.get('DB_NAME', 'postgres')
DB_USER = os.environ.get('DB_USER', 'postgres')
DB_PASSWORD = os.environ.get('DB_PASSWORD', '@1412Yasser@')

print(f"Connecting to {DB_HOST}:{DB_PORT}/{DB_NAME}...")

try:
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASSWORD, sslmode='require',
        connect_timeout=10
    )
    print("Connected!")
    
    # Read and execute the SQL file
    sql_file = os.path.join(os.path.dirname(__file__), '..', 'supabase', 'setup.sql')
    with open(sql_file, 'r') as f:
        sql = f.read()
    
    cur = conn.cursor()
    cur.execute(sql)
    conn.commit()
    print("SQL executed successfully!")
    
    # Verify tables
    for table in ['profiles', 'site_settings', 'projects', 'ai_chat_messages']:
        cur.execute(f"SELECT count(*) FROM information_schema.tables WHERE table_name='{table}'")
        count = cur.fetchone()[0]
        print(f"  Table '{table}': {'EXISTS' if count > 0 else 'NOT FOUND'}")
    
    cur.close()
    conn.close()
    print("Done!")
    
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
