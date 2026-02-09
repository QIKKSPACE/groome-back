CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

ALTER TABLE vendors
ADD COLUMN geo_location geography(Point, 4326);


CREATE INDEX vendors_geo_idx
ON vendors
USING GIST (geo_location);

ALTER TABLE vendors
ADD COLUMN delivery_radius_km FLOAT DEFAULT 10;



CREATE TABLE services_main (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id),
  category_id id REFERENCES services(id), -- correct (parent)
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  discount_price NUMERIC(10,2),
  duration_minutes INT DEFAULT 60,
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE service_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services_main(id),
  image_url TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =========================
-- VENDORS BASE SETTINGS
-- =========================
CREATE TABLE vendor_settings (
  vendor_id UUID PRIMARY KEY REFERENCES vendors(id),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  open_time TIME NOT NULL,           
  close_time TIME NOT NULL,          
  weekly_off_days SMALLINT[] NOT NULL DEFAULT ARRAY[]::smallint[], 
  auto_generate_slots BOOLEAN NOT NULL DEFAULT true,
  employee_count INTEGER NOT NULL DEFAULT 1, -- capacity
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);




-- =========================
-- ONE-TIME CLOSED DAYS
-- =========================
CREATE TABLE closed_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  day_date DATE NOT NULL,           
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_closed_days_vendor_date 
ON closed_days(vendor_id, day_date);


-- =========================
-- MULTI-DAY HOLIDAYS
-- =========================
CREATE TABLE holiday_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_holiday_ranges_vendor 
ON holiday_ranges(vendor_id, start_date, end_date);


-- =========================
-- EXTRA WORKING HOURS / OVERTIME
-- =========================
CREATE TABLE overtimes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  day_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_overtimes_vendor_date 
ON overtimes(vendor_id, day_date);


-- =========================
-- CONFIRMED BOOKINGS
-- =========================
CREATE TABLE confirmed_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  service_id UUID NULL,             
  user_id UUID NULL,                
  employee_slot SMALLINT NOT NULL DEFAULT 1, -- 1 means takes 1 employee capacity
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts   TIMESTAMPTZ NOT NULL,
  slot_date DATE NOT NULL,          
  status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | completed | cancelled
  metadata JSONB DEFAULT '{}'::jsonb, 
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE confirmed_bookings
ALTER COLUMN service_id TYPE UUID[]
USING ARRAY[service_id]::UUID[];
-- ❗ NOTE: We removed overlap EXCLUSION because we allow multiple bookings.
-- Capacity constraint must be validated in application logic or with a trigger.

CREATE INDEX idx_bookings_vendor_date
ON confirmed_bookings (vendor_id, slot_date);

CREATE INDEX idx_bookings_timerange
ON confirmed_bookings (start_ts, end_ts);
-- =========================
-- TEMPORARY RESERVATIONS
-- =========================
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  service_id UUID NULL,
  user_id UUID NULL,
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ NOT NULL,
  slot_date DATE NOT NULL,
  employee_slot SMALLINT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'held', -- held | expired | cancelled | converted
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reservations_vendor_date 
ON reservations(vendor_id, slot_date);



GRANT USAGE, SELECT ON SEQUENCE packages_id_seq TO aurameter_user;

 
 CREATE TABLE creators (
 id SERIAL PRIMARY KEY,
 name VARCHAR(255) NOT NULL,
 number VARCHAR(50) NOT NULL,
 description TEXT NOT NULL,
 price NUMERIC(10,2) NOT NULL,
 video_url TEXT,
 created_at TIMESTAMP DEFAULT NOW(),
 updated_at TIMESTAMP DEFAULT NOW()
 );

GRANT USAGE, SELECT ON SEQUENCE creators_id_seq TO aurameter_user;

-----NEXT PART-----
