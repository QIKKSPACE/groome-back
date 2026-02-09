sudo apt install postgresql postgresql-contrib -y


sudo systemctl start postgresql
sudo systemctl enable postgresql

sudo -i -u postgres

psql


CREATE DATABASE client_09;


CREATE USER aurameter_user WITH PASSWORD 'Njha@963';
GRANT ALL PRIVILEGES ON DATABASE client_09 TO client_09_user;

"C:\Program Files\PostgreSQL\17\bin\pg_dump "-U postgres  -d client_09  --schema-only --no-owner --no-privileges  client_09_schema.sql


sudo -i -u postgres

postgres@srv1063957:~$ psql client_09 < /root/client_09_schema.sql
-bash: /root/client_09_schema.sql: Permission denied

exit
sudo mv /root/client_09_schema.sql /tmp/client_09_schema.sql
sudo chmod 644 /tmp/client_09_schema.sql

sudo apt update
sudo apt install postgis postgresql-16-postgis-3 -y

psql client_09 < /tmp/client_09_schema.sql