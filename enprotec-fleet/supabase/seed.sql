-- =============================================================
--  Enprotec Fleet — Seed Data
--  Run AFTER schema.sql
--  Source: Enprotec vehicle register spreadsheet
-- =============================================================

-- =============================================================
--  SITES  (fleet depot / mine-site locations)
-- =============================================================

INSERT INTO public.sites (name, location, status) VALUES
  ('Equipment Support',    'Middelburg',  'Active'),
  ('Leeuwpan',             'Leeuwpan',    'Active'),
  ('Tshiamo',              'Tshiamo',     'Active'),
  ('Bultfontein',          'Bultfontein', 'Active'),
  ('Grootegeluk',          'Grootegeluk', 'Active'),
  ('Highgrove',            'Highgrove',   'Active'),
  ('Union',                'Union Mine',  'Active'),
  ('Kangra',               'Kangra',      'Active'),
  ('Wonderfontein',        'Wonderfontein','Active'),
  ('Dwarsrivier',          'Dwarsrivier', 'Active'),
  ('Zimbabwe',             'Zimbabwe',    'Active'),
  ('Impala',               'Impala',      'Active'),
  ('Forzando',             'Forzando',    'Active'),
  ('Mavungwani',           'Mavungwani',  'Active'),
  ('RBMR',                 'RBMR',        'Active'),
  ('Thornclif',            'Thornclif',   'Active'),
  ('Kroondal',             'Kroondal',    'Active'),
  ('Makhado',              'Makhado',     'Active'),
  ('Gamsberg',             'Gamsberg',    'Active'),
  ('Blackwattle',          'Blackwattle', 'Active'),
  ('Insimbi',              'Insimbi',     'Active'),
  ('Steelpoort Area',      'Steelpoort',  'Active'),
  ('Keaton',               'Keaton',      'Active'),
  ('Lion',                 'Lion',        'Active'),
  ('Sylvania',             'Sylvania',    'Active'),
  ('Belfast',              'Belfast',     'Active'),
  ('Greenside',            'Greenside',   'Active'),
  ('Goedehoop',            'Goedehoop',   'Active'),
  ('Projects',             'Various',     'Active'),
  ('Operations',           'Various',     'Active'),
  ('Marketing',            'Head Office', 'Active'),
  ('Management',           'Head Office', 'Active'),
  ('Safety',               'Various',     'Active'),
  ('Business Development', 'Head Office', 'Active')
ON CONFLICT DO NOTHING;

-- =============================================================
--  VEHICLES
--  Columns: registration, make, model, vehicle_type, vin,
--           site_name, assigned_driver, fuel_type, status
--
--  NOTE: LDD837MP appears twice in the source data with
--        different VINs. The second entry uses LDD837MP-B.
--        Verify with the fleet register and update accordingly.
--
--  NOTE: New vehicles at the bottom have no registration yet.
--        They use 'NEW-VIN-...' as a placeholder.
-- =============================================================

INSERT INTO public.enprotec_vehicles
  (registration, make, model, vehicle_type, vin, site_name, assigned_driver, fuel_type, status)
VALUES

-- ─── HYR – JZN ────────────────────────────────────────────────
('HYR549MP', 'ISUZU',   'FTR850',                 'Truck',   'ADMFTR34H8G742703',  'Equipment Support', 'Dumisane/Jabu/Sam',            'Diesel', 'Active'),
('JDB076MP', 'VOLVO',   'Truck',                   'Truck',   'YV2JSG0D2EM919417',  'Equipment Support', 'Dumisane/Jabu/Sam',            'Diesel', 'Active'),
('JDT823MP', 'TOYOTA',  'Hilux 2.4 GD6',           'Bakkie',  'AHTJB8DD504751195',  'Leeuwpan',         'Anthony Beukes',               'Diesel', 'Active'),
('JGT749MP', 'TOYOTA',  'Hilux 2.4 GD6',           'Bakkie',  'AHTJB8DD504751746',  'Tshiamo',          'Thabo Khonkhe',                'Diesel', 'Active'),
('JHF550MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0130741',  'Equipment Support', 'Equipment',                   'Diesel', 'Active'),
('JHV114MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0132312',  'Bultfontein',      'Theoadore Magadze',            'Diesel', 'Active'),
('JHV116MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0132687',  'Grootegeluk',      'Trevour Vretas',               'Diesel', 'Active'),
('JLY972MP', 'ISUZU',   'KB300',                   'Bakkie',  'ADMUREER9H4823240',  'Projects',         'Christiaan Van Der Mescht',    'Diesel', 'Active'),
('JLY975MP', 'ISUZU',   'KB300',                   'Bakkie',  'ADMUREER7G4816589',  'Projects',         'Antonio van Zyl',              'Diesel', 'Active'),
('JMN826MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0138958',  'Highgrove',        'Hendrik Auret',                'Diesel', 'Active'),
('JMP527MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0139768',  'Projects',         'Daniel Mouton',                'Diesel', 'Active'),
('JNC164MP', 'ISUZU',   'D-MAX KB300',             'Bakkie',  'ACVUREER3H4006404',  'Projects',         'Jaco De Jager',                'Diesel', 'Active'),
('JPZ314MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0144257',  'Equipment Support', 'Equipment Supp',              'Diesel', 'Active'),
('JRC892MP', 'ISUZU',   'KB250',                   'Bakkie',  'ACVNREHR2H4017782',  'Projects',         'Riaan Pretorius',              'Diesel', 'Active'),
('JSW412MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0145845',  'Union',            'Thabiso Maloka',               'Diesel', 'Active'),
('JSY119MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0155160',  'Bultfontein',      'Sandile Zungu',                'Diesel', 'Active'),
('JTX721MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0156770',  'Tshiamo',          'Lefa Mashiane',                'Diesel', 'Active'),
('JVJ470MP', 'ISUZU',   'KB300',                   'Bakkie',  'ACVUREER6J4022621',  'Projects',         'John Baloyi',                  'Diesel', 'Active'),
('JWF826MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0168512',  'Projects',         'Dylan Kleynhans',              'Diesel', 'Active'),
('JYV863MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0173687',  'Kangra',           'George Oosthuizen',            'Diesel', 'Active'),
('JYZ795MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0174387',  'Bultfontein',      'Johnny Hugo',                  'Diesel', 'Active'),
('JZN058MP', 'ISUZU',   'D-MAX 2.5',               'Bakkie',  'ACVNREHR3J4045841',  'Projects',         'Charl Jansen Van Vuuren',      'Diesel', 'Active'),
('JZN059MP', 'ISUZU',   'KB250',                   'Bakkie',  'ACVNREHR5J4042486',  'Projects',         'Martin Buurman',               'Diesel', 'Active'),

-- ─── KCM – KDL ────────────────────────────────────────────────
('KCM986MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0182547',  'Tshiamo',          'Thabo Khonkhe',                'Diesel', 'Active'),
('KCM993MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0182612',  'Equipment Support', 'Equipment Support',           'Diesel', 'Active'),
('KCM995MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0182607',  'Projects',         'Sello Mogotlane',              'Diesel', 'Active'),
('KCN003MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0181234',  'Wonderfontein',    'Stephan Nel',                  'Diesel', 'Active'),
('KCW643MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0182599',  'Dwarsrivier',      'Attie Ackerman',               'Diesel', 'Active'),
('KCW799MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1L5U0182730',  'Grootegeluk',      'Lindi Cloete',                 'Diesel', 'Active'),
('KCY722MP', 'TOYOTA',  'Etios',                   'Sedan',   'MBJB29BT700130039',  'Highgrove',        'Marketing',                    'Petrol', 'Active'),
('KDL129MP', 'ISUZU',   'KB250 Fleetside',         'Bakkie',  'ACVNRRHRXK4056571',  'Grootegeluk',      'Trevour Vretas',               'Diesel', 'Active'),

-- ─── KLL – KPH ────────────────────────────────────────────────
('KLL442MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0199250',  'Projects',         'Cobus Roos',                   'Diesel', 'Active'),
('KLL450MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0199075',  'Forzando',         'Sipho Mahlangu',               'Diesel', 'Active'),
('KLR071MP', 'TOYOTA',  'Rumion',                  'MPV',     'JTDDND22S00389607',  'Grootegeluk',      'Site Vehicle/Trevour Vretas',  'Petrol', 'Active'),
('KMG845MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0200507',  'Equipment Support', 'Equipment Supp',              'Diesel', 'Active'),
('KMX690MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSNID5U0200947',  'Kroondal',         'Jujuan Kasselman',             'Diesel', 'Active'),
('KNY898MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0205189',  'Highgrove',        'Ashwin Mistri',                'Diesel', 'Active'),
('KPH624MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0206918',  'Zimbabwe',         'Adriaan Botha',                'Diesel', 'Active'),

-- ─── KRF – KTT ────────────────────────────────────────────────
('KRF157MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0207732',  'Union',            'Sboniso Thage',                'Diesel', 'Active'),
('KRW359MP', 'TOYOTA',  'Hilux 2.8 Raider',        'Bakkie',  'AHTAA3DC601712095',  'Operations',       'Phethani Ravele',              'Diesel', 'Active'),
('KRX947MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC001712223',  'Projects',         'N J Erasmus',                  'Diesel', 'Active'),
('KSB756MP', 'VW',      'Kombi',                   'Minibus', 'WV2ZZZ7HZKH196511',  'Grootegeluk',      'Trevour Vretas',               'Diesel', 'Active'),
('KSK982MP', 'TOYOTA',  'Hilux 2.8 Raider',        'Bakkie',  'AHTAA3DC601712243',  'Projects',         'Jan-Louw Dorfling',            'Diesel', 'Active'),
('KTB312MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0210899',  'Makhado',          'Emmanuel Ngwenya',             'Diesel', 'Active'),
('KTD407MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0210194',  'Safety',           'Ruwaan Fourie',                'Diesel', 'Active'),
('KTF079MP', 'ISUZU',   'F-Series',                'Truck',   'ACVFVM34RNZ098992',  'Equipment Support', 'Dumisane/Jabu/Sam',           'Diesel', 'Active'),
('KTM899MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DCX01712407',  'Projects',         'Jeandre Jonker',               'Diesel', 'Active'),
('KTM906MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC101712375',  'Highgrove',        'FC Russouw',                   'Diesel', 'Active'),
('KTR257MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC301712555',  'Highgrove',        'Daryll Alexander',             'Diesel', 'Active'),
('KTT676MP', 'TOYOTA',  'Urban Cruiser',            'SUV',     'JTDPYGJ1S00967558',  'Management',       'Elaine Jansen van Rensburg',   'Petrol', 'Active'),

-- ─── KTV – KVZ ────────────────────────────────────────────────
('KTV931MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0217387',  'Impala',           'Reynhardt Benadie',            'Diesel', 'Active'),
('KTV933MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0217632',  'Forzando',         'Sphiwe Dagane',                'Diesel', 'Active'),
('KTV938MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0217425',  'Mavungwani',       'Anthony Beukes',               'Diesel', 'Active'),
('KTV939MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0217428',  'Grootegeluk',      'Trevour Vretas',               'Diesel', 'Active'),
('KTV941MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0217453',  'RBMR',             'Riaan Visser',                 'Diesel', 'Active'),
('KTV942MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0217450',  'Thornclif',        'Dwayne Heyneke',               'Diesel', 'Active'),
('KTX529MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC901712625',  'Marketing',        'Gavin Marè',                   'Diesel', 'Active'),
('KVV553MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC001712898',  'Highgrove',        'Highgrove Pool Vehicle',       'Diesel', 'Active'),
('KVV554MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC401712628',  'Highgrove',        'Juan-Pierre Du Preez',         'Diesel', 'Active'),
('KVV557MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC101712845',  'Operations',       'Mark Kleynhans',               'Diesel', 'Active'),
('KVW483MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC401712788',  'Management',       'Highgrove Pool Vehicle',       'Diesel', 'Active'),
('KVX635MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC801712888',  'Projects',         'Jurie Geldenhuys',             'Diesel', 'Active'),
('KVY992MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC801712633',  'Highgrove',        'Mel Mentz',                    'Diesel', 'Active'),
('KVY997MP', 'TOYOTA',  'Hilux 2.4 GD6',           'Bakkie',  'AHTJB3DD204531547',  'Equipment Support', 'Equipment',                  'Diesel', 'Active'),
('KVY998MP', 'TOYOTA',  'Hilux 2.4 GD6',           'Bakkie',  'AHTJB3DD704531544',  'Projects',         'Jeandre Ferreira',             'Diesel', 'Active'),
('KVZ001MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC701712817',  'Highgrove',        'Tobie Loftes',                 'Diesel', 'Active'),
('KVZ003MP', 'TOYOTA',  'Hilux 2.4 GD6',           'Bakkie',  'AHTJB3DD004531532',  'Greenside',        'Ernst Mare',                   'Diesel', 'Active'),
('KVZ004MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC701712557',  'Management',       'Jaco Pieterse',                'Diesel', 'Active'),
('KVZ005MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC901712690',  'Operations',       'Andries Luus',                 'Diesel', 'Active'),
('KVZ008MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC201712529',  'Highgrove',        'Marius van Rooyen',            'Diesel', 'Active'),
('KVZ009MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DCX01712830',  'Operations',       'Louwrens du Plessis',          'Diesel', 'Active'),

-- ─── KWF – KZR ────────────────────────────────────────────────
('KWF537MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC301712989',  'Safety',           'Petri Banks',                  'Diesel', 'Active'),
('KWF720MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC401712631',  'Operations',       'NK Msibi',                     'Diesel', 'Active'),
('KWV965MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC101713025',  'Equipment Support', 'Riaan Taljaard',              'Diesel', 'Active'),
('KWV967MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC101712621',  'Marketing',        'Celeste Cheyne',               'Diesel', 'Active'),
('KXH572MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC501712931',  'Management',       'Wikus Klopper',                'Diesel', 'Active'),
('KXP715MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0225578',  'Goedehoop',        'Christo Coetzer',              'Diesel', 'Active'),
('KXP721MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0225843',  'Equipment Support', 'Phlip Dreyer',                'Diesel', 'Active'),
('KXR599MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0225179',  'Equipment Support', 'Stephan Coetzee',             'Diesel', 'Active'),
('KXR607MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0224928',  'Projects',         'Dirkie Meisenheimer',          'Diesel', 'Active'),
('KXR610MP', 'NISSAN',  'NP200',                   'Bakkie',  'ADNUSN1D5U0224896',  'Projects',         'Ernst Mare',                   'Diesel', 'Active'),
('KYG633MP', 'TOYOTA',  'Hilux 2.4 GD6 D/C',       'Bakkie',  'AHTJB3DD804532833',  'Gamsberg',         'Andriaan Botha',               'Diesel', 'Active'),
('KYG634MP', 'TOYOTA',  'Hilux 2.4 GD6 S/C',       'Bakkie',  'AHTCB8CB404147453',  'Equipment Support', 'Equipment',                  'Diesel', 'Active'),
('KZR182MP', 'TOYOTA',  'Hilux GD6 2.8 Raider D/C','Bakkie',  'AHTHA3CD203421252',  'Bultfontein',      'Sandile Zungu',                'Diesel', 'Active'),

-- ─── LDD – LDK ────────────────────────────────────────────────
('LDD836MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0229577',  'Blackwattle',      'Francois Taljaard',            'Diesel', 'Active'),
('LDD837MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0229556',  'Highgrove',        'Highgrove Pool Vehicle',       'Diesel', 'Active'),
-- NOTE: LDD837MP-B has a different VIN (ADNUSN1D5U0229902) assigned to "Project / Chris Kriel".
-- Verify with fleet register. Uncomment when resolved:
-- ('LDD837MP-B','NISSAN','NP200 1.6',              'Bakkie',  'ADNUSN1D5U0229902',  'Projects',         'Chris Kriel',                  'Diesel', 'Active'),
('LDD841MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0229905',  'Insimbi',          'Clyde Mc Dougal',              'Diesel', 'Active'),
('LDD842MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0229901',  'Projects',         'Kamogelo Sekano',              'Diesel', 'Active'),
('LDH182MP', 'TOYOTA',  'HiAce Mini Bus',           'Minibus', 'AHTSS22P507132724',  'Projects',         'Equipment',                    'Diesel', 'Active'),
('LDH184MP', 'TOYOTA',  'HiAce Mini Bus',           'Minibus', 'AHTSS22P907152734',  'Management',       'Management Middelburg',        'Diesel', 'Active'),
('LDH185MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC601714235',  'Management',       'Reinard Griesel',              'Diesel', 'Active'),
('LDK939MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC101714319',  'Operations',       'Paul Dlamini',                 'Diesel', 'Active'),

-- ─── LFK – LJF ────────────────────────────────────────────────
('LFK904MP', 'TOYOTA',  'Hilux 2.8 Legend',        'Bakkie',  'AHTAA3DC301714662',  'Projects',         'Marius van Rensburg',          'Diesel', 'Active'),
('LHH304MP', 'TOYOTA',  'Hilux 2.4 Legend',        'Bakkie',  'AHTJB3DD404539987',  'Projects',         'John Khanye',                  'Diesel', 'Active'),
('LHK064MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0234397',  'Steelpoort Area',  'Tienie Oosthuizen',            'Diesel', 'Active'),
('LHK069MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0231846',  'Equipment Support', 'Equipment/At Nissan for Repairs','Diesel','Active'),
('LHK071MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0227828',  'Keaton',           'Minenhle Masondo',             'Diesel', 'Active'),
('LHK074MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0227936',  'Bultfontein',      'Tshidiso Khalane',             'Diesel', 'Active'),
('LHK076MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0229611',  'Lion',             'Dirkie Grobler',               'Diesel', 'Active'),
('LHN120MP', 'TOYOTA',  'Hilux 2.4 Legend',        'Bakkie',  'AHTJB3DC604502317',  'Projects',         'Jaco Volschenk',               'Diesel', 'Active'),
('LHN124MP', 'TOYOTA',  'Hilux 2.4 Legend',        'Bakkie',  'AHTJB3DC804502352',  'Business Development','Dewald van Rooyen',          'Diesel', 'Active'),
('LHN125MP', 'TOYOTA',  'Hilux 2.4 Legend',        'Bakkie',  'AHTJB3DC304502341',  'Equipment Support', 'Anton Dreyer',                'Diesel', 'Active'),
('LHZ416MP', 'TOYOTA',  'Hilux 2.4 Legend',        'Bakkie',  'AHTJB3DC804502674',  'Projects',         'Christopher Brooks',           'Diesel', 'Active'),
('LHZ426MP', 'TOYOTA',  'Hilux 2.4 Legend',        'Bakkie',  'AHTJB3DC604502608',  'Projects',         'Chris Kriel',                  'Diesel', 'Active'),
('LHZ431MP', 'TOYOTA',  'Hilux 2.4 Legend',        'Bakkie',  'AHTJB3DC904502571',  'Projects',         'Piet du Plessis',              'Diesel', 'Active'),
('LJF271MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0229198',  'Bultfontein',      'Minenhle Ngobe',               'Diesel', 'Active'),
('LJF274MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0231129',  'Sylvania',         'Jeandre Taljaard',             'Diesel', 'Active'),
('LJF276MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0232831',  'Belfast',          'Dylan Oosthuizen',             'Diesel', 'Active'),
('LJF279MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0233078',  'Equipment Support', 'Equipment',                  'Diesel', 'Active'),
('LJF282MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0233645',  'Projects',         'Lufuno Tshimenze',             'Diesel', 'Active'),
('LJF743MP', 'TOYOTA',  'Hilux 2.4 Legend',        'Bakkie',  'AHTJB3DC104502712',  'Marketing',        'Jacques Van Rooijen',          'Diesel', 'Active'),
('LJF923MP', 'NISSAN',  'NP200 1.6',               'Bakkie',  'ADNUSN1D5U0229334',  'Insimbi',          'Terri-Anne DeBreyn',           'Diesel', 'Active'),

-- ─── New vehicles (no registration plate yet) ─────────────────
('NEW-AHTJB3DC104504234', 'TOYOTA', 'Hilux 2.4 GD6 Raider',          'Bakkie', 'AHTJB3DC104504234', NULL, NULL, 'Diesel', 'Active'),
('NEW-AHTAA3DC901715380', 'TOYOTA', 'Hilux 2.6 GD6 Legend',          'Bakkie', 'AHTAA3DC901715380', NULL, NULL, 'Diesel', 'Active'),
('NEW-AHTJB3DC904504336', 'TOYOTA', 'Hilux 2.4 GD6 Raider',          'Bakkie', 'AHTJB3DC904504336', NULL, NULL, 'Diesel', 'Active'),
('NEW-AHTJB3DC104502712', 'TOYOTA', 'Hilux 2.4 GD6 Raider E/CAB',    'Bakkie', 'AHTJB3DC104502712', NULL, NULL, 'Diesel', 'Active'),
('NEW-AHTJB3DC204503741', 'TOYOTA', 'Hilux 2.4 GD6 Raider E/CAB',    'Bakkie', 'AHTJB3DC204503741', NULL, NULL, 'Diesel', 'Active'),
('NEW-AHTJB3DD004543017', 'TOYOTA', 'Hilux 2.4 GD6 Raider D/C',      'Bakkie', 'AHTJB3DD004543017', NULL, NULL, 'Diesel', 'Active')

ON CONFLICT (registration) DO NOTHING;

-- =============================================================
--  Link vehicles to sites by matching site_name
-- =============================================================

UPDATE public.enprotec_vehicles v
SET site_id = s.id
FROM public.sites s
WHERE v.site_name = s.name
  AND v.site_id IS NULL;
