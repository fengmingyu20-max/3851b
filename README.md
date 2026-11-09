# CoolCare ������վ

Ψһά�������е�Ӧ��λ�� `coolcare/`����վ����ȫӢ�ģ���ҳ�����ϴ���Ƶ�������ɫ��ͼƬ�Ϳ�Ƭ���Ʒ��ͳһΪ CoolCare���ͻ�����ʦ�����ҳ�汣������ԭ��ơ����ϴ���Ŀ��ѹ�������˳� Git ���٣������ο�������������Դ��¼�� [ORIGINS.md](coolcare/ORIGINS.md)��

## ����

��Ҫ Node.js 22.13+ �� Docker Desktop��Linux containers�����ڲֿ��Ŀ¼ִ�У�

```powershell
npm run setup
npm run db:up
npm run db:sample
npm start
```

�� http://localhost:3000/ ���Ժ���� Docker Desktop ���к�˫�� `����������վ.cmd`��`npm run db:down` ��ֹͣ���ݿ⣬�������ݾ���

��ǰ������ʾ��������ʦ��ԤԼ����֮ǰ Start service��������������Ϊһ�£�����Ҫʱ�俪�ء�ԤԼ���ڱ��ֲ��䣬��ʼ�����ʱ���¼ʵ�ʲ���ʱ�䡣����������״̬˳���ÿ����ʦֻ��ͬʱ����һ�������Ƽ�����Ч����ǰ��ɵķ����ڱ�����ʹ�� Actual completion date �鿴����ԤԼ�� 14 ����ǰ����Ȼ������

�µ���ֻ��Ҫ��ǰ�ֿ��е��ļ�������Ҫ�� ZIP������ĿĿ¼�� Git LFS��`coolcare/` ��������ǰ��Դ�롢���������Node API�����ݿ�ṹ��Ǩ�ƣ���Ŀ¼����ͳһ�����ű����Ŷ�Լ���� Postman ��������

`db:sample` �ǿ�ѡ�ı����ϳ����ݵ��벽�裺�ṩ 28 ���໥������ԤԼ��2 ������ײ͡�10 ��ά����������������ˮ������ҵ������ʱ��ܾ����ǣ�ֻ��ֹͣ��վ����ȷʹ�� `--replace` �Ż��ڱ��ݺ��滻���ճ� `db:up` ���������ݡ������С�ָ�����ڡ��˺źͱ���˵���� [SAMPLE-DATA.md](coolcare/SAMPLE-DATA.md)��

## �༼ʦ�ɵ�����ֻ��2026-10-28��

ԤԼ֧�� 1�C20 ̨�յ����Զ���ÿ 4 ̨һ����ʦ����ȡ����һ�����룻�ֶ��� Admin ����ѡ��������ָ������ʦ����ϴʱ����ÿ�˷ֵ������̨�����㣬ά�޼�鱣������ʱ�������г�Ա���ճ̺ͽ�ͨ����������ͻ��顣���˶�������һ�ݹ����ͱ��棬������ʦ������������ʦֻ�����������Ե����Ŷӡ�ÿλ��Ա���������¼�͹������ۣ���˾���������Ϳͻ�����ֻ��һ�Ρ�

My Rewards ��Ԥ��ʱ������¼ Points reserved����ȡ�����ܾ������ڻ������ͷ�ʱ��¼ Points returned����ͬ�������ͻ���ǩҳ��Ԥ��������û��֣���ɽ���ʱ���ظ��۷֡����� `npm run db:up` Ӧ�� `35-reward-activity-and-teams.sql`����������ҵ�����ݡ���ϸ����� `coolcare/BOOKING-WORKFLOWS.md` �� `coolcare/COMMERCE-REWARDS.md`��
## ҳ�����˺�

���� Admin �������ӡ��ύ�� 24 Сʱ��δȷ�ϡ����ѣ�δ������û�з�����������ɵ�������������ȷ�Ϻ���ڣ�ԭ�Ŷ��ͷŲ�����ȴ��ɵ���Yearly packages ��ɸѡ�����ڵ��ڻ������ڵ���Լ��ϵ���񣬲���¼��ϵ��������ע������Ա��ʱ�䡣��ϵ��¼�������ʼ����ͻ�֪ͨ��ֻ�ڳɹ��ɵ����������Ա��ȡ������ `npm run db:up` Ӧ�������� `37-admin-plan-reminders.sql`������ԭ���ݡ�

�������ƣ���������Ĭ�ϱ�����ǰ���У�����ȷѡ������ȫ�����������ɵ�δ��������֧�������ܵĿ���ʱ�佨�飻Overview �����ײ���Լ����ϵ/������ڣ��ײ�������״̬����Լɸѡ��������ַ�У�ˢ�º���������غ��Ա��������ֲ��������ݿ�Ǩ�ơ�

| ҳ�� | ��ַ |
| --- | --- |
| CoolCare ��ҳ | `/` |
| ��¼ / ע�� | `/#/login` / `/#/register` |
| �ͻ�ԤԼ������ȡ�������ڣ� | `/customer/bookings`���� `/#/bookings` �Զ�ת�룩 |
| �ͻ� Dashboard / ԤԼ / ��ʷ | `/customer` |
| ��ʦ���� | `/technician/index.html` |
| Admin Console���������ɵ���Ա������棩 | `/admin/orders`��`/admin/inventory` �������ݣ� |
| �ͻ�����ײ� / ���� / �������� | `/customer/plans` / `/customer/rewards` / `/customer/feedback` |
| ��Ӫ���� / ���ֹ��� / ��ʦ���� | `/admin/reports` / `/admin/rewards` / `/admin/performance` |
| ����Ա����ײ͹��� | `/admin/plans` |
| ����Ա����������־ | `/admin/audit` |
| ��ʦ�Լ��ı��ּ�¼ | `/technician/index.html#performance` |

��¼ҳʹ���ֶ��������������ķ�ʽ��¼�����Ƴ�������ʾ��ݰ�ť�������˻������롢�Ự�ͽ�ɫУ�鱣�ֲ��䡣

��ҳ��¼���˺Ž�ɫ�����Ӧ���򣻿ͻ���ͨ��ҳͷ Dashboard ����ԭ�ͻ����ġ�����ע��ʼ��ֻ���� Customer��Admin �� Technician ʹ�� 48 Сʱ��Ч��һ�����������Ӽ����˺ţ�Owner ������ Admin��Owner �� Admin ������ Technician���� SQLite �����˺ű���ԭ�� bcrypt ���룬������ͬ���������˺š�

��ҳ������ͱ��ۺϲ�չʾ���յ�����ѡ��ʵʱʹ�� `/api/public/offers` ��Ŀ¼�۸������ϴ��ά�޼�顢����ײ��ܼۼ�ÿ�η��ã�Ŀ¼����ʧ��ʱ��ʾ���ԣ�����ʾ�鹹�۸��ο�ѡ���ķ�������������˵���ڱ���ҳ��ĵ�¼/ע�������б�������¼�����ԤԼ����ͨ�ͻ���¼���� Dashboard������ My Bookings ��ڽ���ͬһ�ͻ�����ҳ����ҳ��ǰչʾ��ԤԼ���� 14 �졢�����ա�ͬ��ַÿ�����һ����ϴ���ȴ�ȷ�ϵ�ԤԼ����

�ͻ���¼�������� Customer ҳ�������½ǵ�СԲ�����찴ť��Ӣ��������壻ԭ��������ֻ������� Assistant ������Ƴ���**Chat & FAQs** ֧������ؼ��ʻ������⡢Enter ���ͺ� Shift+Enter ���У��������ĸ�������⼰�۵���ʮ���������������⣬���Ǽ۸�ԤԼ/���ڹ����ײ͡����֡�ά�޷��ü���ϵ�����Ŷӣ��۸����Ա��λỰ���ص���ʵĿ¼�������챨�ۻ��ŵ�ʼ����ʹ**Booking** ���� Service��Address��Schedule��Review �Ĳ�ԤԼ���л� FAQ ����������𰸻�������ַ�������ݸ尴�˺ű��浽 MySQL��ȷ��ǰ������¼۸��ײ�ȫ���Ĵ����ڣ��ɹ�����ʾ��ʵ������š�֧��Ӣ�ļ��������Ĺؼ��ʣ��ش𱣳�Ӣ�ģ����⺬��ʱ�ṩ����ѡ�񣬲�֧�ֵ�������ȷ˵����Χ���������ʲ����Զ��ύ���޸Ļ�ȡ���������ʴ�������ڵ�ǰҳ���ڴ棬���ṩ��ʷ��ѯ������Ҫ�ⲿ AI API key������ FAQ �����������ݿ�Ǩ�ƣ�ԭ�вݸ����ͨ������Ǩ������ά����

�ͻ������ṩ������ `/customer/bookings/:id` �������飬�ɲ鿴״̬���ȡ���ԭԤԼ��ʼ���� 72 Сʱǰ�������ڻ�ȡ����δ��ʼ�����ԤԼ��**Contact support** ��д�� `c3549521@uon.edu.au` ���ʼ��ݸ岢���϶�����ţ������Զ����͡�����ײͰ��������ι��飬Dashboard ������ʾ���ԤԼ��ҳ���ڷ���ʱˢ�¶���״̬��

ͷ��˵��ɽ���������Ϻ͵�ַ������֧���޸��������绰��������ַ������Ĭ�ϵ�ַ�͹鵵�ɵ�ַ���޸��ѱ�����ʹ�õĵ�ַ�ᱣ�������ַ��������ʷ����ԭ��ַ���ͻ�ҳ�桢���ֺ���ҳԤԼ/����ʹ�ù̶�Ӣ�����������Ĳ���ϵͳҲ��ʾӢ���·ݡ����ڼ����ڣ�������ϵͳԭ�����ڿؼ����ֻ���ԤԼ�������̶���ʾ��

����ɶ�����ά��������ʾʵ�ʼ�¼�Ĺ���ʱ�������������������Ƭ��֧����Ƭ�Ŵ�� **Print / Save as PDF**��δ��¼��ʱ����ȱʧ��Ƭ����ȷ��ʾ���������鹹�������ݡ�Ǩ�� `11-customer-address-management.sql` �� `npm run db:up` ִ�У������������ݡ�

## ��������

������£�Admin �� Action centre ����ֱ����嶩�����ܾ�ԭ��֧������ѡ� Other ˵���������еĶ���ֻ����Customer �ľܾ�֪ͨ����ʵԤ����¼��ʾ�ѷ������֣��������δ���۵ķ������ʾ�������ѡ���ʦ�� My performance �� Reviews ɸѡ�鿴�Լ�����Ŀͻ����ۡ�Reports & Analytics ֧�ְ����ȣ���Ȼ��ܷ����Annual Packages �ɲ鿴�ͻ�����ײͼ��Ĵζ��������� `npm run db:up` Ӧ��Ǩ�� `34-early-renewal-rewards.sql`�����һ��ԤԼǰ 60 �쿪���������ͻ��ڸô�ԤԼ��ʼǰ�����ɻ� 100 ������֣������ײ͵�һ�η�����ɺ󷢷�һ�Σ���ͨ����������ƣ��ͻ�ҳ����ʾʵ�ʽ�ֹʱ�䡣

������չ����ʹ����ʵҵ���¼������ `npm run db:up` ��Ӧ������Ǩ�ƣ�������������Զ����ֵ� `30-completion-rewards.sql`������ײ�ȷ�����޵� `31-annual-confirmation.sql`��ÿ�η��񱨸������ `32-service-visit-identity.sql` ����ɽ����ϸ�� `33-booking-amount-snapshots.sql`���������ж�����

- **Reports & Analytics** �� `/admin/reports` �������������״̬���������ͺ��ײ���Լͼ������ **Completed vs not completed**���ͻ���������/��/�����۶��ռ�����ײ��Ĵ� visit ��ϸ��֧��ÿ�ա����ȡ���Ⱥ� CSV��Not completed ����ȡ�����ܾ��͹��ڣ���������ʾ������Actual completion date ģʽֻѡ������ɶ�������ע��ͻ����˺Ŵ�����ͳ�ƣ����ܷ���/��ʦɸѡӰ�죻��ԤԼ�ͻ�����ѡ����ȥ�أ����кͿ�����������ֱ����ӡ����۰��״��յ�����ͳ�Ƶ�ǰ������Ǽ���4�C5 ��Ϊ Positive��3 �� Neutral��1�C2 �� Negative��δ�����ų������˷����ͬһ�����ڹ�˾����ֻ��һ�Ρ���ȱ�����г� Completed��Awaiting service��Closed��������ѡ�ײ���ɸѡ��Χ��ķ��ʲ���ȷ��ǣ����������Ķ��⼾�ȴ��������ھ�Ϊ�¼���ʱ�䣻����Ƿ����ֵ����ʵ���տ�����������ݿ�Ǩ�ơ�
- **My Plans** ��ʾԭ����ײ͵��Ĵμ��ȷ���ʹ����������ں��������ѡ��������ɿͻ�ȷ�ϵ�ǰ�۸���ύ�������µ��Ĵ�ԤԼ�������Զ����ѡ�
- **My Rewards** Ĭ�϶�����ɺ�ÿ S$1 �ķ������� 1 �֣�����һ������ȡ������������ʦ׷�ӷ��ã����۳���Ӧ�õĻ����Żݡ�100 �ֵ� S$5���ڴ���ԤԼ��ȷ�ϲ���ѡ��ֿۣ�ҳ����ʾ���û��֡��ֿ۽��͵ֿۺ�Ԥ�����ã��ͻ�ԤԼ����ҳ�� Assistant ʹ����ͬ���򡣶��������Ԥ����ͬһ���񱣴棬ʧ�ܲ����²��ֶ���������ײ����������Ե�һ���ȶ����ֿۡ�My Rewards ��������¼������Ԥ�����ͷ���ڡ���ͨ��������������һ�Σ�����ײͰ������ȶ����ֱ𷢷ţ����ԡ����������ͬһ�����ٴ����Ų����ظ����֡�ȡ�����ܾ�����ڻ��ͷ�δʹ�õ�Ԥ�����֣�����Ա�޸Ĺ���͵������־�����ơ�
- **Technician Performance** ��ÿ�����ż�¼����ʵ�ʼ�ʦ���ݣ���ʾ�ͻ��Ǽ������ۡ�������������ɷ��������ط���������ʼ׼ʱ�ʡ�Admin �� `/admin/performance` ѡ����弼ʦ�鿴��/��/���������ߣ���ʦ�� My performance ֻ�����Լ������ߡ����߰�ʵ�ʷ�������չ��飬��Χ����ꣻ���ڼ����գ�δ���۲�����֡�ѡ�����ڷ�Χ��ǰ/���θ������������۲���ʾ��ֵ���������ܾݴ˶��Է����������ơ�Scoring settings���ۺ����ֺ͹���Ա����������ڼ����Ƴ���

**Booking operation log**��`/admin/audit`�������ɸѡ������š�������𡢾������������Ա��SGT ��ֹ���ڡ��ͻ�/ԭ��/�����ţ������¾����򼰷�ҳ����ַ������Ӧ��ɸѡ��ÿ����¼չʾԭʼ����Ĳ������������ת������������δ��¼���޸�ǰֵ������־ֻ�����ɹ��Ĺ���Ա��������������ȫ��ϵͳ�¼���Owner �ɵ���ȫ��ƥ��������� 10,000 ��������ͨ Admin ���ɵ�����������Ҫ��Сɸѡ��Χ��

����Աʹ�� **Customer Rewards** �������֡���վ�����ṩ����տ���˿�ܣ��� `/admin/payments` ҳ�����ת�� `/admin/rewards`���Ѿ�����ĸ����������ݱ��������ݿ��У����������µĻ��ּ��㣬Ҳ����ͨ��֧��ҳ���ӿڲ������¹���ֻ����������ʵ�ʷ����Ķ�������¼�����Ϊ��ʷ Completed ����׷�����֡��ɱ��治�ᱻ�������ۻ�׼ʱ�ʡ������ API �� [COMMERCE-REWARDS.md](coolcare/COMMERCE-REWARDS.md)��[OPTIONAL-FEATURE-PLANS.md](coolcare/OPTIONAL-FEATURE-PLANS.md) �� [OPTIONAL-FEATURE-PERFORMANCE.md](coolcare/OPTIONAL-FEATURE-PERFORMANCE.md)��

��������ģ��ʹ��ͬһ�� MySQL `coolcare_service_app`����ַΪ���� `3307`����վ���в����� SQLite �����Ŀ��ˡ�

- ��¼ʹ�÷���� HttpOnly �Ự��bcrypt У�顢CSRF �͵�¼Ƶ�����ƣ������������ģ���˺Ż����롣
- �ͻ��뼼ʦ�������Ե�¼�Ự��ÿ���˺�ֻ�ܶ�ȡ�Լ���ԤԼ�򹤵���Admin Console �� Admin/Owner Ȩ��У�飻ֻ�� Owner �������ͣ�� Admin��ת������Ȩ��
- ��ҳ��ԭ�ͻ�ҳ�湲�� booking��service_address��aircon_unit ��ҵ�����ԤԼ״̬�����Ͽɽ����ȡ��
- ��ҳ֧��ԤԼ�ύ����ѯ��ȡ���͸��ڡ�Submitted��Confirmed �� Assigned ԤԼ����ԭԤԼ���� 72 Сʱǰ�����޸ģ�������Ҳ������ 72 Сʱ֮�󡣸��ڻ��ͷž��ɵ������µȴ�ȷ�ϣ��Ѿ���ʼ�������������Ķ�������ϵ�����Ŷӡ�
- ԤԼд�롢�豸��������ע��״̬��ʷ���������ظ����� ID ��ֹ�ظ�ԤԼ��
- Submitted��Confirmed��Assigned��On The Way �� In Progress ԤԼռ���Ŷ�ʱ���������ύ�͸��������ݿ��������¼�飬����ײ��Ĵη���ԭ��ռλ��
- `database/05-public-site.sql` ����ע�ḽ�����ϡ�ԤԼ�������ϡ�������ӳ�����`npm run db:up` �Զ�ִ�з��ƻ���Ǩ����Ȩ�޸��¡�
- ��ѡ�ľ� SQLite ���뱣����Դӳ���ԭʼ״̬���ɿ�û�м۸�ʱ���������Ϊδ֪��

ֻ����ҪǨ���Լ����еľ� SQLite ����ʱ�����������¿�ѡ�������ʾ��·���滻Ϊʵ��Դ�ļ�·���������ݿⲻ�� GitHub �ַ���

```powershell
cd coolcare
node scripts/import-accare.mjs "C:/path/to/ac-care.db"
```

������ֻ����ʽ��Դ�ļ���ͨ����Դӳ��ȥ�أ����ظ����У������ظ�����ͬһ����ʷԤԼ��`--help` ����ʾ�÷������������ݿ⡣��ͨ��װ�������е��롣

## ��Χ˵��

��¼ҳ���Ƴ�δ���õ� Google / Apple ��¼������������ڴ��˺Ű������ṩ��ʵ�ͷ��������ӣ�����ʾ���ᷢ���ʼ��� Send Link ������ע��ҳ�ṩ���Ķ��� Terms of Service �� Privacy Policy��Ҳ��ͨ�� `/#/terms`��`/#/privacy` ���ʣ�����ȷ�γ���ʾ��;������ʹ�÷�Χ��������ʾ���λ��С����У��һ�¡�ԤԼ֪ͨ�ѽ����ʼ����У�����Ĭ���� Mailpit ����������գ������˺��һ��ǲ�ͬ���ܡ���ҳ�۸�Ƭ��ȡ��ǰ���ݿ�Ŀ¼��

Admin Console ���ṩ������ˡ��Զ��ɵ���Ա������Ϳ�������Technician ����ֻ�ܰ�˳���ƽ�״̬������˻ỰĿǰ����ڴ棬��������Ҫ���µ�¼��

## ����ҵ�������ԤԼ�ʼ�

�ͻ�ԤԼֻ��ѡ�������д��ַ�Ϳյ�������ѡ��ʱ�䲢ȷ�ϣ�������̨��ѡ�ѵǼǵĿյ�����ַ����� **Add new address** �Ὣ��ַ���浽��ǰ�ͻ��˺ţ������κͺ���ԤԼʹ�ã�û���ѵǼ��豸���¿ͻ�Ҳ��ԤԼ��Dashboard �� UPCOMING ��Ƭ���������¼��µ�ǰʱ��ɸѡ��δ��ʼ����ЧԤԼ������ʾ���һ����

��ԤԼ�밴�¼�������������ǰ **14 ����Ȼ��**�����ڻ�ȡ������ԭԤԼ���� **72 Сʱ**ǰ�������ʱ��Ҳ��������ǰ 72 Сʱ��ֻ���� **��һ������**�������ղ�Ӫҵ��My Bookings ��ʾ Submitted��Confirmed��Assigned �������еĶ�����Completed��Rejected �� Cancelled �� Booking History �鿴���ܾ�ԭ��Կͻ��ɼ���

ͬһ�ͻ���ͬһ��ַ����ÿ����һ�����յ������������ԤԼһ����ϴ�������ײͺ���ϴ��ά�ޣ���ȡ�����ܾ��͹��ڶ��������롣Repair-only ����������ϴ�������ơ��ͻ�����ע�Ტ��¼����ͬʱѡ�� **Cleaning �� Repair**����ѡ�� **Annual Cleaning Bundle**��Membership ���˳���ԤԼ���̣�ԭ�ж��������ĺͱ��汣����

Ψһ��� Bundle һ���ύ������������ԤԼ������Ϊ�״�ԤԼ������ 3��6��9 ���£�������������ĩ˳�ӵ���һ��ȷ��ǰ��ʾʵ�����ڣ�ԤԼ��������Ŷ�ȷ�ϡ�ȫ��۸��Ĵη�̯��ÿ�η������㣬�����ڴ���ԤԼʱ�������֧������ͨ��ѧ��ϴ�ɼ�ʦ�����¼��ά�޶�������ɼ�ʦ���۲���¼˵��������ͻ�����ȷ�ϡ���ǰ�۸񡢲ο���Դ�ͽ����߽�� [SERVICE-PRICING.md](coolcare/SERVICE-PRICING.md)��

�����̶����� `Submitted �� Confirmed �� Assigned �� On The Way �� In Progress �� Completed`��Admin �������� Orders ��׼������ Dispatch ���������Զ��ɵ���ϵͳ���ų������û�ʱ���ͻ�ļ�ʦ��������ƥ����ͬ�ʱ࣯��������󰴵��츺�ء����δ�ɵ�ʱ��� technician ID ѡ��λ��ʹ�õ���ǰһ����ַ��ʦ base postal code������ֻ������ӽ��ȣ�����ʾʵ�ʹ��������г�ʱ�䡣�ܾ�����������д�ͻ��ɼ�ԭ�򲢽��� Rejected������Ա���޶�ԭ�򣬱����汾����ơ�ȡ�����ܾ������ں���ɶ����ͷ��Ŷ��������½� Submitted ����Ĭ�� 48 Сʱδȷ�Ϻ��Զ����ڣ�`BOOKING_CONFIRMATION_HOURS` ������Ϊ 1�C720 Сʱ����Ǩ��ǰ���ж������������ޣ���ȷ��/���ɵ��������ᱻ�Զ����ڡ�

Owner/Admin ������ Technician �����������״̬��Owner ���ɹ��� Admin������Ψһ Owner ����ԭ��ת������һ�� Active Admin������Ա���޸����/����������ʱ�估�������޸ı�����Ƽ�¼��ͬ����档��ʦ�����Լ��Ĺ����ڳ��⣻�����ÿ̨�յ�������׼��ʾ���������ɲ鿴��ص�ַ����� Bundle ά�����档��ϴ����������¼ͬ����Ȩ�ޡ������汾���޸���ơ�

���� `npm run db:up` �ᱣ�������ݲ������������ݱ���ͬʱ���������������䡣ԤԼ��� **http://localhost:8025** �鿴�Զ����ɵ��ʼ������������ڿ�����ʾ��**������ͻ��ⲿ����Ͷ��**����ʽͶ����Ҫ�ڱ������þ�����֤�� SMTP �����˺š���ϸ�������ݱ������ü� [BOOKING-WORKFLOWS.md](coolcare/BOOKING-WORKFLOWS.md)��

## ��֤

���ֲֿ���������������֤�������Ŀ¼�İ�װ���á����ƻ���Ǩ�ơ��ϳ����ݡ�����ع����ԡ�TypeScript ������������Ա�����̵���ʵ MySQL ���ɲ��Ը������밲ȫ��Owner Ψһ�ԡ���˼��ɵ�����ѯ������״̬˳�����һ����������Ĳ�������������˽�˱��ݱ����ڱ��� `.local/backups/`�����ύ GitHub��

```powershell
npm test
npm --prefix coolcare run test:db
node coolcare/node_modules/typescript/bin/tsc --noEmit -p coolcare/tsconfig.json
npm run build
```

��֤���ǿͻ����¼������CSRF�������ݵ����ԡ���ַ������Ĭ��/�鵵���˺��л�������ԤԼ���ơ�����ײ͡������ơ�ʱ���ʱ����˽����Ƭ HTTP Ȩ�ޣ����������ֲݸ�ָ���Ա�����롢Owner ת������ˡ��ܾ����ɵ��������ɵ�����ʦ״̬���Ŷ���������������չ������Ҫ�����������������ظ��ύ����ɶ����Զ����֡����ֵֿۡ��������ܣ��Լ����������ż�¼����Ŀͻ����ۺͼ�ʦ��Ч�����ݿ����ͨ������ع��򰴲��Լ�¼����������������ſ��ܳ��ֿպš����������Ե�ǰ�������Ϊ׼��

���ֽ���ع��ص㣺�����խ���л� FAQ/Booking ��ȷ��δ�����ַ����ʧ���˶����/δ��ɡ��Ĵ��ײͷ��ʼ� CSV ����ͬɸѡ��������ͻ�����ȥ�ء����۱༭��δ���ۿ�ֵ��ȷ�ϼ�ʦ���ܲ鿴�Լ����������ߣ���֤������־���ڱ߽硢��������غ��ɸѡ�ָ��Լ� Owner/Admin ����Ȩ�ޡ��Զ������ǲ��ܴ���ʵ��ҳ���飬ִ�н��Ӧ�����β��Լ�¼˵����

��ǰ�ͻ����̵��������鸲�����漰 390px �ֻ����֣����ԤԼ����ȷ����������л������ϱ�������¶�ȡ������/Ĭ��/�༭/�鵵��ַ����������ԭ��ַ���ظ�ԤԼ���ڽ��á�Ӣ�����������ѡ�ա���ʵ����/ȡ������ʷ���������ִ����Ĵ����ԤԼ������ʱ����ȱʧ��Ƭ��ʾ����ʵ�ļ��Ŵ����ڸ�ʽ����ʹ���������Ի����Ͷ��ϵͳʱ�������ڿؼ��̶���ʾӢ�ġ������˺š���ַ����������Ƭ���������������ݣ���֤��������

������չ���ܵ���������Ӧ�������漰 390px �ֻ����֣�My Plans �鿴���ȷ��񡢰���ǰĿ¼�۸��ֶ������������Ĵ�ԤԼ���ͻ��ύ���ۡ�����Ա�鿴���ۻ��ܼ���ʦ�鿴�Լ������ۣ���ɶ������Զ����֡�ԤԼ�ֿۺ͹���Ա���ֵ�����Reports & Analytics ɸѡ����������ܼ� CSV ����������ʹ�ö��������˺źͶ�������ִ���ⲿ���ף�Ҳ�������Զ����ѻ������������ա�

PDF ���ܵ����������ӡ���ڲ��ṩר�ô�ӡ��ʽ������δ���ղ���ϵͳ��ӡ/PDF �Ի��򡣿ͷ��ʼ�����ֻԤ���ռ��˺Ͷ�����ţ�δ�����ⲿ�ʼ����������ڿͻ��������գ����������������������ա�

## ��ʦ����������ٴ�����

My Jobs �� Service Reports �ṩͳһ�� **Service updates and outcome**����ʦ�ɼ�¼�ӳ�����ʱ�䡢ȱ��ԭ���ٴ�����ԤԼ���ٴ����ſ�ʼ/��ɼ�ά�޶�����á��ӳ�ʱ�䰴 15 ���ӵ�����ÿ����� 120 ���ӣ����� 18:00 ǰ�����������ͬʱ����Ŷ������͸ü�ʦ������ԤԼ����ͻʱҪ����ڻ��¼�ٴ����š��ٴ����ű�����ԭ������ԭ�����У��������Ͽ��ĵڶ��ݱ��棻���η������ʱ�䲻�����ǡ�

ά�޶�������ɸ���ʦֱ����д����˵��������Ҫ�ͻ������Ա������׼�����ö�����ԭԤԼ��ͷ��ã����治�����յ�������з�����±������ɸ��ǵ��¼���¼���ظ��ύ�������ͻ��͹���Ա�����ڶ���/�����в鿴����ʦ Profile ��ά����λ�¼��� base postal code������λ���ɵ�ʹ�á�Ǩ�� `21-service-progress.sql` �����������ݣ�ʹ������ `npm run db:up` Ӧ�á�

## GitHub

��Աʹ�� Codex ʱ�����ڸ��Ե��� clone ��������ֿ⣻��Ŀ¼ `AGENTS.md` �ṩͳһ����ĿԼ�������п����� `coolcare/` ���У�����Ŀ����������µ� clone �С�

�״λ�ȡ��

```powershell
git clone https://github.com/YuZixiong3549521/3851b.git
cd 3851b
npm run setup
npm run db:up
npm run db:sample
npm start
```

����Ŀ�����˵�����Լ��������ͨ����֤�ĸ���ֱ���ύ�����͵� `main`����������Ҫ��ʹ�÷�֧�� Pull Request������ǰ�Ȼ�ȡ������Զ�˸Ķ�����ǿ�����ͣ���ȡǰ���ύ�����Ʊ��浱ǰ�޸ġ������б仯ʱ���°�װ��Ӧ���������ݿ�Ǩ���б仯ʱ���� `npm run db:up`��

**ÿλ��Ա�ı������ݿ��Ƕ����ġ�** GitHub ͬ�����롢����/Ǩ���ļ��ͺϳ��������ɽű�������ͬ�����������Ķ�����Docker ���ݾ�����¼�Ự��˽�˱��ݡ�������ʾ�ɵ��� `coolcare/postman/CoolCare-Booking-Demo.postman_collection.json`�����Լ��Ļ����ϴ��������������� `node coolcare/scripts/verify-booking.mjs <�������>` ֱ�Ӳ�ѯ MySQL����� `coolcare/postman/README.md`��

ͳһ UI Լ��λ�� `coolcare/UI-ARCHITECTURE.md`�����˸��� shadcn/ui��Base UI��Tailwind �� Lucide��

`.gitignore` �ų�����ƾ�ݡ������������ļ���IDE ���漰���ϴ��ο�Ŀ¼��ԭ�ϴ��ļ��ɴ���ʷ�ύ���ģ�����ռ�ݵ�ǰ��֧����Ŀ�б���ͬ������ʹ�� `git pull --ff-only origin main`���״����а��Ϸ���װ����׼������������

Azure ������������ü� [AZURE-DEPLOYMENT.md](coolcare/AZURE-DEPLOYMENT.md)����ǰ�Ự�������ڴ棬�������˳���¼���ⲿ�ʼ����Զ��һ����뼰�罻��¼�����ڱ�����ʾ��Χ��������ʾ���輰���Ƽ� [PRESENTATION-CHECKLIST.md](coolcare/PRESENTATION-CHECKLIST.md)��

Technician parts issuing supports up to 30 distinct part rows with separate quantities and descriptions. `POST /api/technician/jobs/:jobId/stock-out-batch` accepts `{ request_id, items }`; all stock changes are committed together or rolled back, with idempotent retries. The existing single-part endpoint remains supported.

### September 24 booking and dispatch updates

Cleaning is SGD 50 per unit per visit, with a planned 45 minutes per unit; Repair keeps a SGD 50 minimum diagnostic visit fee and a planned 60 minutes. Combined visits add the two service durations. Actual reserved time drives capacity and dispatch overlap checks, and new visits must finish by 6:00 PM. Annual prices use the selected Singapore property type and included AC allowance from the database; existing booking prices remain unchanged.

The customer form separates service issues from **Other remarks** (for example, a preferred technician). A preference does not override availability. Rejected and expired requests have a **Book again** action. Customer booking/report views show technician extensions, return-visit records and additional repair quotations. Admin Orders highlights unconfirmed requests in red, shows expiry deadlines, and lets staff correct rejection reasons without erasing the audit.

Run the normal `npm run db:up` to apply migrations 19�C22. They preserve existing bookings and add pricing tiers, deadlines, postal dispatch fields, service-progress events and customer notices. Git shares these schema/code changes; it does not transfer another developer��s local orders.

## Return visit approval workflow
Run `npm run db:up` to apply migration 23; existing work orders/reports are retained. Technicians request a return during In Progress, which closes that visit and places the original booking in Awaiting return arrangement (not History). Admin Orders has a Return visits queue: approve and notify the customer, or ask for a new time. The customer receives an in-app notice and chooses a weekday at least 14 calendar days ahead (Singapore time) in My Bookings. Slot capacity is checked on selection and again on admin confirmation. Admin confirms and selects an available technician; overlapping work is rejected. The same work order becomes Return visit, then Start service makes it In Progress. End service completes it; another return requirement can repeat the process. Technician self-scheduling APIs are rejected. Retained visit snapshots and service event history remain attached to the same report. Notifications are in-app; this workflow does not send an external email.

## Azure App Service

Cloud startup and environment settings: [coolcare/AZURE-DEPLOYMENT.md](coolcare/AZURE-DEPLOYMENT.md). Root `npm start` still starts local development; the deployed coolcare directory uses `npm start` for production.

���ϲ����������ʹ�� [COURSEWORK-DATA.md](coolcare/COURSEWORK-DATA.md) �е�һ����׷�ӹ��ߣ�����ԭ���ݣ����� 50 ������������ģ�ⶩ����ͬһ�����ظ�ִ�в����ظ����롣GitHub �Զ�����ֻ�ϴ����򣬲���ִ�иù��߻�ͬ���������ݿ⣻�� Azure �������ڲ������ȷִ��Ԥ���������к͵��롣
